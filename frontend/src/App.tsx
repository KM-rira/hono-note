import HonoNotePage from "./HonoNotePage";
import EditNotePage from "./EditNotePage";
import RegisterPage from "./RegisterNotePage";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
    return (
        <BrowserRouter basename="/hono-note/frontend">
            <Routes>
                <Route path="/" element={<HonoNotePage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/edit/:id" element={<EditNotePage />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App;
