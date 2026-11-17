import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import {viteSingleFile} from 'vite-plugin-singlefile';
// Normal build = multi-file dist. Set SINGLE=1 to emit one self-contained HTML (used for the client preview).
export default defineConfig({base:'./',server:{proxy:{'/api':'http://localhost:3000'}},plugins:[react(),...(process.env.SINGLE?[viteSingleFile()]:[])]});
