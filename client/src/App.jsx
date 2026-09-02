import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientForm from './pages/ClientForm.jsx';
import Billing from './pages/Billing.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import RecordPayment from './pages/RecordPayment.jsx';
import Payments from './pages/Payments.jsx';
import Settings from './pages/Settings.jsx';
import Roles from './pages/Roles.jsx';
import Team from './pages/Team.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
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
      <Route path="/invite" element={<AcceptInvite />} />

      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="invoices" element={<Billing />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="invoice/:id" element={<InvoiceView />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/new" element={<RecordPayment />} />
        <Route path="invoices/:id/pay" element={<RecordPayment />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/roles" element={<Roles />} />
        <Route path="settings/team" element={<Team />} />
      </Route>

      <Route path="*" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
