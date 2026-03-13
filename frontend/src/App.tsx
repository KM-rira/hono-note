import HonoNotePage from "./HonoNotePage";
import EditNotePage from "./EditNotePage";
import "./App.css";

function App() {
    const path = window.location.pathname;

    if (path.includes("edit")) {
        return <EditNotePage />;
    }

    return <HonoNotePage />;
}

export default App;
