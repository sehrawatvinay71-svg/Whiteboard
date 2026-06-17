import Board from "./Components/Board";
import BoardProvider from "./Components/store/BoardProvider";
import Toolbar from "./Components/Toolbar";

function App() {
  return (
    <BoardProvider>
      <Toolbar />
      <Board />
    </BoardProvider>
  );
}

export default App;
