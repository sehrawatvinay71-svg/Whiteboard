import Board from "./Components/Board";
import BoardProvider from "./Components/store/BoardProvider";
import ToolboxProvider from "./Components/store/ToolboxProvider";
import Toolbar from "./Components/Toolbar";
import Toolbox from "./Components/Toolbox";

function App() {
  return (
    <BoardProvider>
      <ToolboxProvider>
        <Toolbar />
        <Board />
        <Toolbox />
      </ToolboxProvider>
    </BoardProvider>
  );
}

export default App;
