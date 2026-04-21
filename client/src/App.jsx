import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { SettingsProvider } from './context/SettingsContext';
import { ConfirmProvider } from './context/ConfirmContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <SettingsProvider>
          <ConfirmProvider>
            <Router>
              <AppRoutes />
            </Router>
          </ConfirmProvider>
        </SettingsProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;
