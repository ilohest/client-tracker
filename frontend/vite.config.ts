import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite'; 
import path from 'path';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

// --- PLUGIN CUSTOM : THEME EDITOR ---
const themeEditorPlugin = (): Plugin => ({
  name: 'vite-plugin-theme-editor',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api/dev/save-theme', async (req: IncomingMessage, res: ServerResponse, next: Function) => {
      if (req.method !== 'POST') return next();

      try {
        let body = '';
        req.on('data', (chunk: Buffer | string) => body += chunk);
        await new Promise(resolve => req.on('end', resolve));
        
        const themeData = JSON.parse(body) as { 
            palette: string[], 
            neutrals?: { dark: string, light: string, surface: string } 
        };

        const rootDir = process.cwd();
        const stylePath = path.join(rootDir, 'src/style.css');
        const mainTsPath = path.join(rootDir, 'src/main.ts');

        // 2. MISE A JOUR MAIN.TS
        if (fs.existsSync(mainTsPath)) {
            let mainContent = fs.readFileSync(mainTsPath, 'utf-8');
            mainContent = mainContent.replace(
                /primary:\s*palette\(['"].*['"]\)/, 
                `primary: palette('${themeData.palette[0]}')`
            );
            fs.writeFileSync(mainTsPath, mainContent);
        }

        // 3. MISE A JOUR STYLE.CSS
        if (fs.existsSync(stylePath)) {
            let styleContent = fs.readFileSync(stylePath, 'utf-8');
            const newSecondary = themeData.palette[1] || '#64748b';
            
            styleContent = styleContent.replace(
                /--secondary-color:\s*#[a-fA-F0-9]{6};?/i,
                `--secondary-color: ${newSecondary};`
            );

            if (themeData.neutrals) {
                styleContent = styleContent
                    .replace(/--color-surface-dark:\s*#[a-fA-F0-9]{6};?/i, `--color-surface-dark: ${themeData.neutrals.dark};`)
                    .replace(/--color-surface-light:\s*#[a-fA-F0-9]{6};?/i, `--color-surface-light: ${themeData.neutrals.light};`)
                    .replace(/--color-surface-card:\s*#[a-fA-F0-9]{6};?/i, `--color-surface-card: ${themeData.neutrals.surface};`)
                    .replace(/background-color:\s*#[a-fA-F0-9]{6};?/i, `background-color: ${themeData.neutrals.light};`)
                    .replace(/color:\s*#[a-fA-F0-9]{6};?/i, `color: ${themeData.neutrals.dark};`);
            }
            
            styleContent = styleContent.replace(/\s*--color-accent-\d+:\s*#[a-fA-F0-9]{6};?/g, '');

            let newAccentsBlock = '';
            if (themeData.palette.length > 2) {
                newAccentsBlock = themeData.palette.slice(2).map((col: string, index: number) => {
                    return `\n  --color-accent-${index + 1}: ${col};`;
                }).join('');
            }

            const secondaryRegex = /(--secondary-color:\s*#[a-fA-F0-9]{6};?)/i;
            styleContent = styleContent.replace(secondaryRegex, `$1${newAccentsBlock}`);

            fs.writeFileSync(stylePath, styleContent);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));

      } catch (err) {
        console.error('Erreur Theme Editor:', err);
        res.statusCode = 500;
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.end(JSON.stringify({ error: errorMessage }));
      }
    });
  }
})

// --- CONFIGURATION VITE ---
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    themeEditorPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@contracts': path.resolve(__dirname, '../packages/contracts/src'),
      
    }
  },
  
});