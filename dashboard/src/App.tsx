import { Navigate, Route, Routes } from "react-router-dom";
import { CaseDetail } from "./pages/CaseDetail";
import { CaseList } from "./pages/CaseList";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cases" replace />} />
      <Route path="/cases" element={<CaseList />} />
      <Route path="/cases/:id" element={<CaseDetail />} />
    </Routes>
  );
}
