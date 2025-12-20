import { Routes, Route } from 'react-router-dom';
import './App.css';
import Landing from './screens/Landing';
import SignIn from './screens/SignIn';
import SignUp from './screens/SignUp';
import Dashboard from './screens/Dashboard';
import RoomPage from './screens/Room';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meeting/:roomId" element={<RoomPage />} />
      </Routes>
    </div>
  );
}

export default App;
