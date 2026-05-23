import { AppProviders } from './components/providers/AppProviders';
import AppRouter from './routes/AppRouter';

export const App = () => {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};

export default App;
