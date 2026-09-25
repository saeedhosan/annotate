// Central application identity.
//
// Everything that needs the app's executable name, display title, or
// description reads from this single object via `app.name`, `app.title`,
// `app.description`, etc. Values are sourced from `package.json` (and its
// `build` section), so a rename only requires editing that one file.
//
// Read at runtime via `app.getAppPath()` instead of a static import so the
// compiled code resolves to the packaged app's own `package.json` (the asar
// root), keeping them in sync without shipping a second copy.

import { app as electronApp } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { slug } from '../lib/utility.js';

type PackageMetadata = {
    version: string;
    name: string;
    description: string;
    productName?: string;
    appId?: string;
    build?: {
        productName?: string;
        appId?: string;
    };
};

const pkg = JSON.parse(
    readFileSync(path.join(electronApp.getAppPath(), 'package.json'), 'utf8'),
) as PackageMetadata;

// In development `package.json` carries a `build` section, but electron-builder
// strips it from the packaged copy. `extraMetadata` re-injects the top-level
// fields there, so fall back to them when `build` is gone.
const productName = pkg.build?.productName ?? pkg.productName ?? pkg.name;
const appId = pkg.build?.appId ?? pkg.appId ?? 'annotate.app';

export const app = {
    name: pkg.name,
    version: pkg.version,
    slug: slug(pkg.name),
    title: productName,
    description: pkg.description,
    appId,
};
