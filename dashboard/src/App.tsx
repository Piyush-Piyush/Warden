import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ThemeToggle } from "./components/ThemeToggle";
import { WardenMark } from "./components/WardenMark";
import { CaseDetail } from "./pages/CaseDetail";
import { CaseList } from "./pages/CaseList";

function Header() {
  return (
    <header className="wd-header">
      <Link to="/cases" className="wd-header__logo" style={{ color: "inherit" }}>
        <WardenMark />
      </Link>
      <Link to="/cases" className="wd-header__title" style={{ color: "inherit" }}>
        Warden
      </Link>
      <span className="wd-header__subtitle">incident response</span>
      <span className="wd-header__spacer" />
      <ThemeToggle />
    </header>
  );
}

export function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
      </Routes>
    </>
  );
}
