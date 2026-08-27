import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientForm from './pages/ClientForm.jsx';
import Billing from './pages/Billing.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import RecordPayment from './pages/RecordPayment.jsx';
import Settings from './pages/Settings.jsx';
import Roles from './pages/Roles.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { RequireAuth, RedirectIfAuthed } from './components/RouteGuards.jsx';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/signup"
        element={
          <RedirectIfAuthed>
            <Signup />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPassword />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/reset-password"
        element={
          <RedirectIfAuthed>
            <ResetPassword />
          </RedirectIfAuthed>
        }
      />

      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/clients" element={<RequireAuth><Clients /></RequireAuth>} />
      <Route path="/clients/new" element={<RequireAuth><ClientForm /></RequireAuth>} />
      <Route path="/clients/:id/edit" element={<RequireAuth><ClientForm /></RequireAuth>} />
      <Route path="/invoices" element={<RequireAuth><Billing /></RequireAuth>} />
      <Route path="/invoices/new" element={<RequireAuth><InvoiceForm /></RequireAuth>} />
      <Route path="/invoices/:id/edit" element={<RequireAuth><InvoiceForm /></RequireAuth>} />
      <Route path="/invoice/:id" element={<RequireAuth><InvoiceView /></RequireAuth>} />
      <Route path="/payments/new" element={<RequireAuth><RecordPayment /></RequireAuth>} />
      <Route path="/invoices/:id/pay" element={<RequireAuth><RecordPayment /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/settings/roles" element={<RequireAuth><Roles /></RequireAuth>} />

      <Route path="*" element={<RequireAuth><Dashboard /></RequireAuth>} />
    </Routes>
  );
}
