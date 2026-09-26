import {defineConfig} from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5176,proxy:{'/api':{target:'http://127.0.0.1:3006',ws:true},'/health':'http://127.0.0.1:3006'}}});
