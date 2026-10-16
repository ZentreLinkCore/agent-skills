#!/usr/bin/env node
/**
 * check-changed.mjs — compile ONLY the changed frontend files, instead of `npm run build`.
 *
 *   node .agents/scripts/check-changed.mjs                      # uncommitted changes (default)
 *   node .agents/scripts/check-changed.mjs --base origin/master # everything on the branch
 *   node .agents/scripts/check-changed.mjs path/a.vue path/b.ts # these files only
 *
 * Run it from the project root. It loads the project's own vite.config through Vite in
 * middleware mode (no port, no HMR, no `public/hot`, no dependency pre-bundling) and runs
 * each file through the same plugin pipeline `vite build` uses, so it fails on the same
 * things the build fails on for those files:
 *
 *   - a script, template, or style block that does not compile;
 *   - an import that does not resolve (wrong path, deleted file, missing package);
 *   - a named import the target module does not export (a renamed or removed export).
 *
 * The named-import check also runs on the files that import a changed .ts/.js module or a
 * deleted file, so a rename that breaks an unchanged caller is still caught.
 *
 * It does not type-check (neither does `vite build`) and does not bundle the whole app.
 * Exit code 0 = clean, 1 = errors found, 2 = could not run.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SOURCE_DIR = 'resources';
const SCRIPT_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue'];
const CHECK_EXT = [...SCRIPT_EXT, '.css', '.scss'];
const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.json'];
const SKIP = /(^|\/)(node_modules|public\/build|vendor)\/|\.d\.ts$|\.(test|spec)\.[jt]sx?$/;

function git(...args) {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').filter(Boolean);
}

function changedFiles(base) {
    const from = base ? git('merge-base', 'HEAD', base)[0] : 'HEAD';
    return {
        changed: [
            ...git('diff', '--name-only', '--diff-filter=d', from),
            ...git('ls-files', '--others', '--exclude-standard'),
        ],
        deleted: git('diff', '--name-only', '--diff-filter=D', from),
    };
}

const inScope = (file) => file.startsWith(`${SOURCE_DIR}/`) && !SKIP.test(file);

function listSources(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(ROOT, full);
        if (entry.isDirectory()) {
            if (!SKIP.test(`${rel}/`)) listSources(full, out);
        } else if (SCRIPT_EXT.includes(path.extname(entry.name)) && !SKIP.test(rel)) {
            out.push(rel);
        }
    }
    return out;
}

/** Files that import any of `targets` (absolute paths), found textually; Vite does the real check. */
function findImporters(targets, aliases) {
    const wanted = new Set();
    for (const target of targets) {
        const noExt = target.replace(/\.[^./]+$/, '');
        wanted.add(target);
        wanted.add(noExt);
        if (path.basename(noExt) === 'index') wanted.add(path.dirname(noExt));
    }
    const importRe = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
    const importers = [];
    for (const rel of listSources(path.join(ROOT, SOURCE_DIR))) {
        const file = path.join(ROOT, rel);
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(importRe)) {
            let spec = (match[1] ?? match[2] ?? match[3]).split('?')[0];
            const alias = aliases.find((a) => typeof a.find === 'string' && (spec === a.find || spec.startsWith(`${a.find}/`)));
            if (alias) spec = alias.replacement + spec.slice(alias.find.length);
            else if (spec.startsWith('.')) spec = path.resolve(path.dirname(file), spec);
            else continue;
            const candidates = [spec, spec.replace(/\.[^./]+$/, ''), ...RESOLVE_EXT.map((ext) => `${spec}/index${ext}`)];
            if (candidates.some((candidate) => wanted.has(candidate))) {
                importers.push(rel);
                break;
            }
        }
    }
    return importers;
}

/** `{ a, b as c }` / `Default` / `* as ns` in an import or export-from statement → imported names. */
function importedNames(statement) {
    const head = statement.split(/\bfrom\b/)[0];
    if (/^\s*import\s*\*/.test(head) || /^\s*export\s*\*/.test(head)) return [];
    const names = [];
    if (/^\s*import\s+[\w$]+\s*(,|$)/.test(head)) names.push('default');
    const braces = head.match(/\{([^}]*)\}/);
    if (braces) {
        for (const part of braces[1].split(',')) {
            const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
            if (name && !part.trim().startsWith('type ')) names.push(name);
        }
    }
    return names;
}

const isLocalModule = (url) =>
    url.startsWith('/') && !url.startsWith('/node_modules/') && !url.startsWith('/@') &&
    !url.includes('?') && SCRIPT_EXT.includes(path.extname(url));

async function main() {
    const args = process.argv.slice(2);
    const baseIndex = args.indexOf('--base');
    const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
    const explicit = args.filter((arg, i) => !arg.startsWith('--') && (baseIndex < 0 || i !== baseIndex + 1));

    const { changed, deleted } = explicit.length
        ? { changed: explicit.map((f) => path.relative(ROOT, path.resolve(f))), deleted: [] }
        : changedFiles(base);
    const targets = [...new Set(changed)].filter((f) => inScope(f) && CHECK_EXT.includes(path.extname(f)) && fs.existsSync(f));
    const gone = deleted.filter((f) => inScope(f) && SCRIPT_EXT.includes(path.extname(f)));

    if (!targets.length && !gone.length) {
        console.log('No changed frontend files under resources/ — nothing to check.');
        return 0;
    }

    // Resolve from the project being checked, not from this script's folder.
    const requireFromProject = createRequire(path.join(ROOT, 'package.json'));
    const load = async (name) => import(pathToFileURL(requireFromProject.resolve(name)).href);
    let vite;
    let lexer;
    try {
        vite = await load('vite');
        const lexerModule = await load('es-module-lexer');
        lexer = lexerModule.parse ? lexerModule : lexerModule.default;
    } catch (error) {
        console.error(`Cannot load vite / es-module-lexer from ${ROOT}/node_modules (run npm install): ${error.message}`);
        return 2;
    }
    await lexer.init;

    const loaded = await vite.loadConfigFromFile({ command: 'serve', mode: 'development' }, undefined, ROOT, 'error');
    if (!loaded) {
        console.error('No vite.config found in the current directory. Run this from the project root.');
        return 2;
    }
    // laravel-vite-plugin deletes `public/hot` when the process exits, which would cut a
    // running `npm run dev` off from Laravel. It only matters for serving and bundling.
    const plugins = (await Promise.all([loaded.config.plugins ?? []].flat(Infinity)))
        .flat(Infinity)
        .filter((plugin) => plugin && !String(plugin.name ?? '').startsWith('laravel'));
    const server = await vite.createServer({
        ...loaded.config,
        plugins,
        configFile: false,
        root: ROOT,
        mode: 'development',
        appType: 'custom',
        logLevel: 'error',
        clearScreen: false,
        optimizeDeps: { noDiscovery: true, include: [] },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null, preTransformRequests: false },
    });
    const env = server.environments?.client ?? server;
    const aliases = server.config.resolve.alias ?? [];

    const transformed = new Map();
    const transform = (url) => {
        if (!transformed.has(url)) transformed.set(url, env.transformRequest(url));
        return transformed.get(url);
    };

    const exportCache = new Map();
    async function exportsOf(url, seen = new Set()) {
        if (exportCache.has(url)) return exportCache.get(url);
        if (seen.has(url)) return { names: new Set(), open: true };
        seen.add(url);
        const result = await transform(url);
        const [imports, exports] = lexer.parse(result.code);
        const names = new Set(exports.map((e) => e.n));
        let open = false;
        for (const imp of imports) {
            if (imp.d !== -1 || !/^\s*export\s*\*\s*from/.test(result.code.slice(imp.ss, imp.se))) continue;
            if (!imp.n || !isLocalModule(imp.n)) { open = true; continue; }
            const inner = await exportsOf(imp.n, seen);
            inner.names.forEach((n) => n !== 'default' && names.add(n));
            open ||= inner.open;
        }
        const value = { names, open };
        exportCache.set(url, value);
        return value;
    }

    const errors = [];
    async function check(rel) {
        const url = `/${rel}`;
        let result;
        try {
            result = await transform(url);
        } catch (error) {
            const where = error.loc ? `:${error.loc.line}:${error.loc.column}` : '';
            errors.push(`${rel}${where}\n    ${String(error.message).split('\n')[0]}${error.frame ? `\n${error.frame.replace(/^/gm, '    ')}` : ''}`);
            return;
        }
        if (!SCRIPT_EXT.includes(path.extname(rel))) return;
        const [imports] = lexer.parse(result.code);
        for (const imp of imports) {
            if (imp.d !== -1 || !imp.n || !isLocalModule(imp.n)) continue;
            const names = importedNames(result.code.slice(imp.ss, imp.se));
            if (!names.length) continue;
            let target;
            try {
                target = await exportsOf(imp.n);
            } catch {
                continue; // the target's own compile error is reported when it is checked
            }
            if (target.open) continue;
            const missing = names.filter((n) => !target.names.has(n));
            if (missing.length) {
                errors.push(`${rel}\n    "${missing.join('", "')}" not exported by ${imp.n.slice(1)}`);
            }
        }
    }

    const scriptTargets = targets.filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f));
    const importerSources = [...scriptTargets, ...gone].map((f) => path.join(ROOT, f));
    const importers = importerSources.length
        ? findImporters(importerSources, aliases).filter((f) => !targets.includes(f))
        : [];

    console.log(`Checking ${targets.length} changed file(s)` +
        (importers.length ? ` + ${importers.length} importer(s) of changed/deleted modules` : '') + '…');

    try {
        for (const rel of [...targets, ...importers]) await check(rel);
    } finally {
        await server.close();
    }

    if (errors.length) {
        console.error(`\n✗ ${errors.length} problem(s):\n`);
        errors.forEach((e) => console.error(`  ${e}\n`));
        return 1;
    }
    console.log(`✓ ${targets.length + importers.length} file(s) compile; imports resolve and match their exports.`);
    if (gone.length) console.log(`  (deleted: ${gone.join(', ')} — no remaining importer breaks)`);
    return 0;
}

main().then((code) => process.exit(code), (error) => {
    console.error(`check-changed could not run: ${error.message.split('\n')[0]}`);
    process.exit(2);
});
