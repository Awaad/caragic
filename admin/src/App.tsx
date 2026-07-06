import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { SubmissionsListPage } from "@/features/submissions/SubmissionsListPage";
import { SubmissionDetailPage } from "@/features/submissions/SubmissionDetailPage";
import { TokensListPage } from "@/features/tokens/TokensListPage";
import { ModesListPage } from "@/features/modes/ModesListPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ChatsPage } from "@/features/chats/ChatsPage";
import { ModeDetailPage } from "./features/modes/ModeDetailPage";
import { ModeEditPage } from "./features/modes/ModeEditPage";
import { ModeCreatePage } from "./features/modes/ModeCreatePage";



export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <AuthGuard>
            <Shell />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/submissions" element={<SubmissionsListPage />} />
        <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
        <Route path="/tokens" element={<TokensListPage />} />
        <Route path="/modes" element={<ModesListPage />} />
        <Route path="/modes/new" element={<ModeCreatePage />} />
        <Route path="/modes/:name" element={<ModeDetailPage />} />
        <Route path="/modes/:name/edit" element={<ModeEditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chats/:id" element={<ChatsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
