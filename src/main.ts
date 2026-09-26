import "./style.css";
import { Game } from "./game/Game";
const game = new Game();
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
