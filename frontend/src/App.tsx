import HonoNotePage from "./HonoNotePage";
// import EditNotePage from "./EditNotePage";
import "./App.css";

function App() {
    const path = window.location.pathname;

    // if (path === "/hono-note/frontend/edit") {
    //     return <EditNotePage />;
    // }

    return <HonoNotePage />;
}

export default App;
