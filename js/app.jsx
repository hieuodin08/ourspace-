// ====== ROOT ======
var App = () => {
  const [user, setUser] = useState(() => loadSession(DB));

  const handleJoin = ({ id, name }) => {
    setUser({ id, name });
  };

  const handleLeave = () => {
    clearSession(DB);
    setUser(null);
  };

  return (
    <DBContext.Provider value={DB}>
      {!user ? <Lobby onJoin={handleJoin} /> : <CallRoom user={user} onLeave={handleLeave} />}
    </DBContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
