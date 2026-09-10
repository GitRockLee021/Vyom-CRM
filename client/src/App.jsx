import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequireAuth, RedirectIfAuthed } from './components/RouteGuards.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Clients = lazy(() => import('./pages/Clients.jsx'));
const ClientForm = lazy(() => import('./pages/ClientForm.jsx'));
const Billing = lazy(() => import('./pages/Billing.jsx'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm.jsx'));
const InvoiceView = lazy(() => import('./pages/InvoiceView.jsx'));
const RecordPayment = lazy(() => import('./pages/RecordPayment.jsx'));
const PaymentForm = lazy(() => import('./pages/PaymentForm.jsx'));
const Payments = lazy(() => import('./pages/Payments.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Roles = lazy(() => import('./pages/Roles.jsx'));
const Team = lazy(() => import('./pages/Team.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Signup = lazy(() => import('./pages/Signup.jsx'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface-container-lowest">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="font-body-md text-body-md text-on-surface-variant">Loading…</span>
      </div>
    </div>
  );
}

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
        <Route index element={<Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense>} />
        <Route path="clients" element={<Suspense fallback={<LoadingScreen />}><Clients /></Suspense>} />
        <Route path="clients/new" element={<Suspense fallback={<LoadingScreen />}><ClientForm /></Suspense>} />
        <Route path="clients/new/quick" element={<Suspense fallback={<LoadingScreen />}><ClientForm quick /></Suspense>} />
        <Route path="clients/:id/edit" element={<Suspense fallback={<LoadingScreen />}><ClientForm /></Suspense>} />
        <Route path="invoices" element={<Suspense fallback={<LoadingScreen />}><Billing /></Suspense>} />
        <Route path="invoices/new" element={<Suspense fallback={<LoadingScreen />}><InvoiceForm /></Suspense>} />
        <Route path="invoices/:id/edit" element={<Suspense fallback={<LoadingScreen />}><InvoiceForm /></Suspense>} />
        <Route path="invoice/:id" element={<Suspense fallback={<LoadingScreen />}><InvoiceView /></Suspense>} />
        <Route path="payments" element={<Suspense fallback={<LoadingScreen />}><Payments /></Suspense>} />
        <Route path="payments/new" element={<Suspense fallback={<LoadingScreen />}><RecordPayment /></Suspense>} />
        <Route path="payments/:id/edit" element={<Suspense fallback={<LoadingScreen />}><PaymentForm /></Suspense>} />
        <Route path="invoices/:id/pay" element={<Suspense fallback={<LoadingScreen />}><RecordPayment /></Suspense>} />
        <Route path="tasks" element={<Suspense fallback={<LoadingScreen />}><Tasks /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<LoadingScreen />}><Settings /></Suspense>} />
        <Route path="settings/roles" element={<Suspense fallback={<LoadingScreen />}><Roles /></Suspense>} />
        <Route path="settings/team" element={<Suspense fallback={<LoadingScreen />}><Team /></Suspense>} />
      </Route>

      <Route path="*" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense>} />
      </Route>
    </Routes>
  );
}