const fs = require('fs');
const {execSync} = require('child_process');
const tar = require('tar');

// eslint-disable-next-line no-undef
const unityPackagePath = process.env.INPUT_PACKAGE_PATH;
// eslint-disable-next-line no-undef
const iconPath = process.env.INPUT_ICON_PATH;
const iconNotFoundBehavior = process.env.INPUT_ICON_NOT_FOUND_BEHAVIOR;
const packageNotFoundBehavior = process.env.INPUT_PACKAGE_NOT_FOUND_BEHAVIOR;

// region Validation
console.log('Validating inputs...');
// Make sure the behaviour flags are valid
const validBehaviors = ['fail', 'warn', 'ignore'];
if (!validBehaviors.includes(iconNotFoundBehavior)) {
    throw new Error(`Invalid icon not found behavior: ${iconNotFoundBehavior}`);
}
if (!validBehaviors.includes(packageNotFoundBehavior)) {
    throw new Error(
        `Invalid package not found behavior: ${packageNotFoundBehavior}`,
    );
}

// Make sure the Icon ends with .png and exists
if (!iconPath.endsWith('.png')) {
    throw new Error(`Icon path must end with .png: ${iconPath}`);
}
if (!fs.existsSync(iconPath)) {
    switch (iconNotFoundBehavior) {
    case 'fail':
        throw new Error(`Icon not found at path: ${iconPath}`);
    case 'warn':
        console.warn(`Icon not found at path: ${iconPath}`);
        return;
    case 'ignore':
        console.log(`Icon not found at path: ${iconPath}`);
        return;
    }
}

// Make sure the Unity Package ends with .unitypackage and exists
if (!unityPackagePath.endsWith('.unitypackage')) {
    throw new Error(
        `Unity Package path must end with .unitypackage: ${unityPackagePath}`,
    );
}
if (!fs.existsSync(unityPackagePath)) {
    switch (packageNotFoundBehavior) {
    case 'fail':
        throw new Error(`Unity Package not found at path: ${unityPackagePath}`);
    case 'warn':
        console.warn(`Unity Package not found at path: ${unityPackagePath}`);
        return;
    case 'ignore':
        console.log(`Unity Package not found at path: ${unityPackagePath}`);
        return;
    }
}
// endregion

// region Prepare
console.log(`Extracting Unity Package...`);
// Create a temporary directory
const tempDir = fs.mkdtempSync('tmp_unitypackage-icon-action_');
// Extract the Unity Package (.gz) to the temporary directory
// Keep the .tar file intact
execSync(`gzip -d -c ${unityPackagePath} > ${tempDir}/archtemp.tar`);
// Copy the icon to the temporary path as .icon.png
console.log(`Preparing icon...`);
fs.copyFileSync(iconPath, `${tempDir}/.icon.png`);
iconPath = `${tempDir}/.icon.png`;
// endregion

// region Modify
console.log(`Modifying Unity Package...`);
// Check if a ".icon.png" file exists in the root of the package
// If it does, remove it
const iconFile = '.icon.png';
const filenames = [];
tar.list({
    file: `${tempDir}/archtemp.tar`,
    onentry: (entry) => filenames.push(entry.path),
    sync: true,
});
if (filenames.includes(iconFile)) {
    console.warn(`Found existing icon file, overwriting...`);
    execSync(`tar --delete --file=${tempDir}/archtemp.tar '${iconFile}'`);
}
// Add the new icon file to the root of the package
execSync(
    `tar --append --file=${tempDir}/archtemp.tar` +
    ` --directory=${tempDir} '${iconFile}'`,
);
// endregion

// region Package
// Compress the temporary directory back into a Unity Package (.gz)
console.log(`Building Unity Package...`);
const previousPath = process.cwd();
process.chdir(tempDir);
execSync(`gzip -c archtemp.tar > ${unityPackagePath}`);
process.chdir(previousPath);
// endregion

// region Cleanup
// Delete the temporary directory
console.log(`Cleaning up...`);
fs.rmSync(tempDir, {recursive: true});
// endregion
