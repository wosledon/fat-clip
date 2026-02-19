import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Settings } from "./pages/Settings";
import { Tags } from "./pages/Tags";
import { Shortcuts } from "./pages/Shortcuts";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/tags" element={<Tags />} />
      <Route path="/shortcuts" element={<Shortcuts />} />
    </Routes>
  );
}

export default App;
