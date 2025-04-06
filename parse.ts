import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from 'fs';
import * as path from 'path';

// Get current file path and directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputDir = path.resolve(__dirname, './boundries');
const outputDir = path.resolve(__dirname, 'jsondata');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

function getAllTsFiles(dir: string): string[] {
    const files: string[] = [];

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            files.push(...getAllTsFiles(fullPath));
        } else if (item.endsWith('.ts')) {
            files.push(fullPath);
        }
    }

    return files;
}

const files = getAllTsFiles(inputDir);

// Create a combined districts GeoJSON structure
const combinedDistricts = {
    type: "FeatureCollection",
    features: [] as any
};

(async () => {
    for (const filePath of files) {
        const relativePath = path.relative(inputDir, filePath);
        const name = path.basename(relativePath, '.ts');
        const outputPath = path.join(outputDir, path.dirname(relativePath));

        try {
            // Create nested output directories if they don't exist
            fs.mkdirSync(outputPath, { recursive: true });

            const mod = await import(filePath);
            const data = mod.default;
            if (data?.features) {
                for (let feature of data.features) {
                    if (feature.properties) {
                        if (feature.properties.st_code && !feature.properties.st_code?.startsWith('S')) {
                            feature.properties['st_code'] = `S${feature.properties.st_code}`;
                        }
                        if (feature.properties.dt_code && !feature.properties.dt_code?.startsWith(feature.properties.st_code)) {
                            feature.properties['dt_code'] = `${feature.properties.st_code}${feature.properties.dt_code}`;
                        }
                    }
                }

                // Add features to combined districts if they exist
                combinedDistricts.features.push(...data.features);
            }
            fs.writeFileSync(path.join(outputPath, `${name}.json`), JSON.stringify(data, null, 2));
            console.log(`✅ ${relativePath} -> ${name}.json written.`);
        } catch (err) {
            console.error(`❌ Failed to process ${relativePath}:`, err);
        }
    }

    // Write the combined districts file
    fs.writeFileSync(
        path.join(outputDir, 'districts_boundaries.json'),
        JSON.stringify(combinedDistricts, null, 2)
    );
    console.log('✅ Combined districts file written to districts_boundaries.json');
})();
