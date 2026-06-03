// ============================================================================
//  HOME  — Màn hình chính kiểu Zalo: Tin nhắn / Danh bạ / Cá nhân
//  Dữ liệu lấy từ Firebase (js/firebase.js). Tông màu giữ theo Ourspace.
// ============================================================================

// ---- Avatar tròn (chữ cái đầu + màu theo uid) ----
var Avatar = ({ name, color, size = 44, online }) => (
  <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div
      className="w-full h-full rounded-full flex items-center justify-center font-bold text-white select-none"
      style={{ background: color || '#2563eb', fontSize: size * 0.38 }}
    >
      {initialsOf(name)}
    </div>
    {online && (
      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
    )}
  </div>
);

// ---- Định dạng thời gian gọn ----
var fmtTime = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString('vi-VN', { weekday: 'short' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// ============================================================================
//  CỬA SỔ CHAT (1-1)
// ============================================================================
var ChatThread = ({ profile, other, onBack, onCall, peerStatus }) => {
  const convId = useMemo(() => convIdOf(profile.uid, other.uid), [profile.uid, other.uid]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const tts = useTextToSpeech();
  const endRef = useRef(null);

  useEffect(() => {
    if (!fbConfigured()) return;
    const unsub = fbSubscribeMessages(convId, setMessages);
    return () => unsub && unsub();
  }, [convId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const members = [
    { uid: profile.uid, name: profile.displayName, color: profile.avatarColor },
    { uid: other.uid, name: other.displayName, color: other.avatarColor },
  ];

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      await fbSendMessage(convId, members, {
        senderId: profile.uid, senderName: profile.displayName, text,
      });
    } catch (e) {
      setInput(text);
      alert('Gửi tin nhắn thất bại: ' + (e?.message || ''));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-blue-950/80 bg-slate-950/60 backdrop-blur flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Avatar name={other.displayName} color={other.avatarColor} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{other.displayName}</div>
          <div className="text-[11px] text-slate-400 truncate">@{other.username}</div>
        </div>
        <button onClick={() => onCall(other)} disabled={peerStatus !== 'connected'}
          title="Gọi video"
          className="os-call-btn relative text-white p-2.5 rounded-xl disabled:opacity-40">
          <span className="os-call-ring relative z-10"><Video className="w-5 h-5" /></span>
        </button>
      </div>

      {/* Tin nhắn */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm py-10">
            Bắt đầu trò chuyện với <b className="text-slate-300">{other.displayName}</b>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === profile.uid;
          return (
            <div key={msg.id} className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {msg.recalled ? (
                <div className="max-w-[78%] px-3 py-1.5 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 text-slate-400 italic text-xs flex items-center gap-1.5">
                  <Undo className="w-3 h-3" /> Tin nhắn đã thu hồi
                </div>
              ) : (
                <div className={`relative max-w-[78%] px-3.5 py-2 rounded-2xl ${isMe ? 'bg-gradient-to-br from-blue-600 to-sky-500 text-white rounded-br-md' : 'bg-slate-700 text-white rounded-bl-md'}`}>
                  <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                  {!isMe && (
                    <button onClick={() => tts.speak(msg.text, 'vi-VN')} className="os-tts-chip mt-1">
                      <span className="os-tts-bars"><i></i><i></i><i></i><i></i></span>
                      Đọc to
                    </button>
                  )}
                  {isMe && (
                    <button onClick={() => fbRecallMessage(convId, msg.id)} title="Thu hồi"
                      className="os-msg-recall-btn absolute -left-9 top-1/2 -translate-y-1/2 bg-slate-900/90 hover:bg-red-600 text-slate-300 hover:text-white px-1.5 py-1 rounded-full border border-slate-700 hover:border-red-500 flex items-center justify-center">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="text-[10px] text-slate-500 mt-0.5 px-1">{fmtTime(msg.timestamp)}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Ô nhập */}
      <div className="p-3 border-t border-blue-950/80 bg-slate-950/40">
        <div className="flex gap-2 items-end">
          <textarea value={input} rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Nhập tin nhắn..."
            className="flex-1 resize-none px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm max-h-32" />
          <button onClick={send} disabled={!input.trim() || sending}
            className="os-send-btn px-3.5 py-2.5 disabled:opacity-50 text-white rounded-xl shrink-0">
            <span className="os-send-icon inline-flex"><Send className="w-4 h-4" /></span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
//  MODAL: Thêm bạn (tìm theo username)
// ============================================================================
var AddContactModal = ({ profile, onClose, onAdded }) => {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(undefined); // undefined=chưa tìm, null=ko thấy
  const [relation, setRelation] = useState('none'); // none | pending-out | pending-in | friends
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    setSearching(true); setMsg(''); setResult(undefined); setRelation('none');
    try {
      const found = await fbFindByUsername(term);
      if (found && found.uid === profile.uid) { setResult(null); setMsg('Đây là chính bạn 🙂'); }
      else if (found) {
        setResult(found);
        const fr = await fbGetFriendship(profile.uid, found.uid).catch(() => null);
        if (fr?.status === 'accepted') setRelation('friends');
        else if (fr?.status === 'pending') setRelation(fr.requestedBy === profile.uid ? 'pending-out' : 'pending-in');
        else setRelation('none');
      } else setResult(null);
    } catch (e) { setMsg('Lỗi tìm kiếm: ' + (e?.message || '')); }
    finally { setSearching(false); }
  };

  // Gửi lời mời (nếu người kia đã gửi cho mình trước thì coi như đồng ý luôn).
  const sendReq = async (user) => {
    setSending(true); setMsg('');
    try {
      const res = await fbSendFriendRequest(profile, user);
      if (res.ok) {
        onAdded?.(user);
        setMsg(res.autoAccepted ? 'Đã trở thành bạn bè 🎉' : 'Đã gửi lời mời kết bạn ✓');
        setRelation(res.autoAccepted ? 'friends' : 'pending-out');
      } else setMsg(res.error || 'Không gửi được lời mời');
    } finally { setSending(false); }
  };

  return (
    <div className="os-dialog-backdrop fixed inset-0 bg-black/70 backdrop-blur z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="os-dialog-card bg-slate-900 border border-blue-900/60 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-sky-400" />
          <h3 className="text-lg font-bold flex-1">Thêm bạn</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Nhập tên đăng nhập (username)"
            className="flex-1 px-3 py-2 bg-slate-950 border border-blue-900/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <button onClick={search} disabled={!q.trim() || searching}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center">
            {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>

        {result === null && !msg && <p className="text-sm text-slate-400 text-center py-3">Không tìm thấy người dùng này.</p>}
        {msg && <p className="text-sm text-amber-300 text-center py-2">{msg}</p>}
        {result && (
          <div className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl">
            <Avatar name={result.displayName} color={result.avatarColor} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{result.displayName}</div>
              <div className="text-xs text-slate-400 truncate">@{result.username}</div>
            </div>
            {relation === 'friends' ? (
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 bg-slate-700/60 text-emerald-300">
                <Check className="w-4 h-4" /> Bạn bè
              </span>
            ) : relation === 'pending-out' ? (
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-700/60 text-slate-300">
                Đã gửi lời mời
              </span>
            ) : (
              <button onClick={() => sendReq(result)} disabled={sending}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center gap-1">
                {sending ? <Loader className="w-4 h-4 animate-spin" />
                  : relation === 'pending-in' ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {relation === 'pending-in' ? 'Đồng ý' : 'Kết bạn'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
//  TAB: Tin nhắn
// ============================================================================
var MessagesTab = ({ profile, conversations, onOpen }) => (
  <div className="flex-1 overflow-y-auto">
    {conversations.length === 0 ? (
      <div className="text-center text-slate-500 px-6 py-16">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium text-slate-400">Chưa có cuộc trò chuyện</p>
        <p className="text-sm mt-1">Vào tab <b className="text-slate-300">Danh bạ</b> để nhắn tin cho bạn bè.</p>
      </div>
    ) : conversations.map(c => (
      <button key={c.id} onClick={() => onOpen({ uid: c.otherUid, displayName: c.otherName, avatarColor: c.otherColor, username: '' })}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5 text-left transition">
        <Avatar name={c.otherName} color={c.otherColor} size={50} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate flex-1">{c.otherName}</span>
            <span className="text-[11px] text-slate-500 shrink-0">{fmtTime(c.lastTime)}</span>
          </div>
          <div className="text-sm text-slate-400 truncate">
            {c.lastSender === profile.uid && <span className="text-slate-500">Bạn: </span>}
            {c.lastMessage || '...'}
          </div>
        </div>
      </button>
    ))}
  </div>
);

// ============================================================================
//  TAB: Danh bạ
// ============================================================================
var ContactsTab = ({ friends, incoming, onOpen, onCall, onRemove, onAdd, onAccept, onReject, peerStatus }) => (
  <div className="flex-1 overflow-y-auto">
    <button onClick={onAdd}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 border-b border-white/5 text-left text-sky-300">
      <span className="w-12 h-12 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
        <UserPlus className="w-5 h-5" />
      </span>
      <span className="font-semibold">Thêm bạn mới</span>
    </button>

    {/* Lời mời kết bạn đến — duyệt hoặc từ chối */}
    {incoming.length > 0 && (
      <div className="border-b border-white/5">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sky-300/80">
          Lời mời kết bạn ({incoming.length})
        </div>
        {incoming.map(r => (
          <div key={r.pairId} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={r.displayName} color={r.avatarColor} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{r.displayName}</div>
              <div className="text-xs text-slate-400 truncate">muốn kết bạn với bạn</div>
            </div>
            <button onClick={() => onAccept(r)} title="Chấp nhận"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Đồng ý
            </button>
            <button onClick={() => onReject(r)} title="Từ chối"
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    )}

    {friends.length === 0 ? (
      <div className="text-center text-slate-500 px-6 py-12">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Chưa có bạn bè. Bấm <b className="text-sky-300">Thêm bạn mới</b> để gửi lời mời.</p>
      </div>
    ) : friends.map(c => (
      <div key={c.uid} className="group flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/5">
        <Avatar name={c.displayName} color={c.avatarColor} size={48} />
        <button onClick={() => onOpen(c)} className="min-w-0 flex-1 text-left">
          <div className="font-semibold truncate">{c.displayName}</div>
          <div className="text-xs text-slate-400 truncate">@{c.username}</div>
        </button>
        <button onClick={() => onOpen(c)} title="Nhắn tin"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button onClick={() => onCall(c)} title="Gọi video" disabled={peerStatus !== 'connected'}
          className="p-2 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-600/40 disabled:opacity-30">
          <Video className="w-5 h-5" />
        </button>
        <button onClick={() => onRemove(c)} title="Xoá khỏi danh bạ"
          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition">
          <Trash className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
);

// ============================================================================
//  TAB: Cá nhân
// ============================================================================
var ProfileTab = ({ profile, onSave, onLogout, myPeerId, peerStatus }) => {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [about, setAbout] = useState(profile.about || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setDisplayName(profile.displayName || ''); setAbout(profile.about || ''); }, [profile]);

  const save = async () => {
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    try { await onSave({ displayName: name, about: about.trim() }); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Bìa + avatar */}
      <div className="relative">
        <div className="h-28" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb 60%, #38bdf8)' }} />
        <div className="px-5 -mt-12 flex items-end gap-4">
          <div className="ring-4 ring-slate-900 rounded-full">
            <Avatar name={profile.displayName} color={profile.avatarColor} size={88} online={peerStatus === 'connected'} />
          </div>
          <div className="pb-2 min-w-0">
            <div className="font-bold text-lg truncate">{profile.displayName}</div>
            <div className="text-sm text-slate-400 truncate">@{profile.username}</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {editing ? (
          <div className="space-y-3 bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Tên hiển thị</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Giới thiệu</label>
              <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={2}
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">Huỷ</button>
              <button onClick={save} disabled={saving || !displayName.trim()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center justify-center gap-1">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lưu
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Giới thiệu</div>
              <p className="text-sm text-slate-200">{profile.about || 'Chưa có giới thiệu.'}</p>
            </div>
            <button onClick={() => setEditing(true)}
              className="w-full py-2.5 bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <Pencil className="w-4 h-4" /> Chỉnh sửa trang cá nhân
            </button>
          </>
        )}

        {/* Thông tin tài khoản */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl divide-y divide-slate-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-400">Tên đăng nhập</span>
            <span className="text-sm font-mono">@{profile.username}</span>
          </div>
          {profile.email && (
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">Email</span>
              <span className="text-sm truncate max-w-[60%]">{profile.email}</span>
            </div>
          )}
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <span className="text-sm text-slate-400 shrink-0">ID gọi video</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-mono text-emerald-300 truncate">{myPeerId || 'Đang kết nối...'}</span>
              {myPeerId && (
                <button onClick={() => { navigator.clipboard?.writeText(myPeerId); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="text-emerald-400 hover:text-emerald-200 shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <button onClick={onLogout}
          className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
    </div>
  );
};

// ============================================================================
//  MODAL: Sửa hồ sơ (mở khi chạm sao trung tâm ở giao diện Vũ trụ trên máy tính)
//  Hiện chỉ sửa tên hiển thị + giới thiệu (theo yêu cầu: tạm bỏ đổi avatar).
// ============================================================================
var ProfileEditModal = ({ profile, onSave, onLogout, onClose, peerStatus }) => {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [about, setAbout] = useState(profile.about || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = displayName.trim();
    if (!name) return;
    setSaving(true);
    try { await onSave({ displayName: name, about: about.trim() }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="os-dialog-backdrop fixed inset-0 bg-black/70 backdrop-blur z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <div className="os-dialog-card bg-slate-900 border border-blue-900/60 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-sky-400" />
          <h3 className="text-lg font-bold flex-1">Hồ sơ của bạn</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col items-center gap-2 mb-4">
          <Avatar name={profile.displayName} color={profile.avatarColor} size={84} online={peerStatus === 'connected'} />
          <div className="text-xs text-slate-400">@{profile.username}</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Tên hiển thị</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Giới thiệu</label>
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
          <button onClick={save} disabled={saving || !displayName.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lưu
          </button>
          <button onClick={onLogout}
            className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-300 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
//  HOME (shell + điều hướng tab + cửa sổ chat)
// ============================================================================
var Home = ({ profile, onSaveProfile, onLogout, onStartCall, myPeerId, peerStatus }) => {
  const [tab, setTab] = useState('messages');
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingReqs, setIncomingReqs] = useState([]);
  const [openChatWith, setOpenChatWith] = useState(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const isMobile = useIsMobile();
  const GalaxyView = window.GalaxyView;

  useEffect(() => {
    if (!fbConfigured()) return;
    const u1 = fbSubscribeConversations(profile.uid, setConversations);
    const u2 = fbSubscribeFriendships(profile.uid, ({ friends, incoming }) => {
      setFriends(friends); setIncomingReqs(incoming);
    });
    return () => { u1 && u1(); u2 && u2(); };
  }, [profile.uid]);

  // Mở chat từ tab Tin nhắn (chỉ có otherUid/Name) → bổ sung username từ danh bạ nếu có
  const openChat = (other) => {
    const known = friends.find(c => c.uid === other.uid);
    setOpenChatWith(known ? { ...known } : other);
  };

  const removeContact = async (c) => {
    if (confirm(`Huỷ kết bạn với ${c.displayName}?`)) await fbDeleteFriendship(c.pairId);
  };
  const acceptRequest = async (r) => { await fbAcceptFriendRequest(r.pairId); };
  const rejectRequest = async (r) => { await fbDeleteFriendship(r.pairId); };

  // Đang mở 1 cuộc trò chuyện
  if (openChatWith) {
    return (
      <div className="h-full flex flex-col">
        <ChatThread profile={profile} other={openChatWith}
          onBack={() => setOpenChatWith(null)} onCall={onStartCall} peerStatus={peerStatus} />
      </div>
    );
  }

  // 💻 MÁY TÍNH: cả màn Thông tin là "Vũ trụ" — thao tác qua dock, chạm sao
  // trung tâm để sửa hồ sơ. 📱 Điện thoại: rơi xuống giao diện tab bên dưới.
  if (!isMobile && GalaxyView) {
    return (
      <div className="h-full relative">
        <GalaxyView
          profile={profile}
          friends={friends}
          incoming={incomingReqs}
          conversations={conversations}
          onOpenChat={openChat}
          onStartCall={onStartCall}
          onAccept={acceptRequest}
          onDecline={rejectRequest}
          onAddFriend={() => setShowAddContact(true)}
          onEditProfile={() => setEditProfile(true)}
          showMessages
        />
        {showAddContact && (
          <AddContactModal profile={profile} onClose={() => setShowAddContact(false)} onAdded={() => {}} />
        )}
        {editProfile && (
          <ProfileEditModal profile={profile} onSave={onSaveProfile} onLogout={onLogout}
            peerStatus={peerStatus} onClose={() => setEditProfile(false)} />
        )}
      </div>
    );
  }

  const TABS = [
    { key: 'messages', label: 'Tin nhắn', Icon: MessageSquare },
    { key: 'contacts', label: 'Danh bạ', Icon: Users, badge: incomingReqs.length },
    { key: 'profile', label: 'Cá nhân', Icon: Settings },
  ];
  const titleMap = { messages: 'Tin nhắn', contacts: 'Danh bạ', profile: 'Cá nhân' };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-blue-950/80 bg-slate-950/60 backdrop-blur flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-sky-500 rounded-lg flex items-center justify-center">
          <Hand className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg flex-1">{titleMap[tab]}</span>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 rounded-lg text-xs">
          {peerStatus === 'connected'
            ? <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400">Sẵn sàng gọi</span></>
            : <><Loader className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">Đang kết nối</span></>}
        </div>
        {tab === 'contacts' && (
          <button onClick={() => setShowAddContact(true)} className="p-2 rounded-lg text-sky-300 hover:bg-white/10">
            <UserPlus className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Nội dung */}
      {tab === 'messages' && <MessagesTab profile={profile} conversations={conversations} onOpen={openChat} />}
      {tab === 'contacts' && <ContactsTab friends={friends} incoming={incomingReqs}
        onOpen={openChat} onCall={onStartCall} onRemove={removeContact}
        onAdd={() => setShowAddContact(true)} onAccept={acceptRequest} onReject={rejectRequest}
        peerStatus={peerStatus} />}
      {tab === 'profile' && <ProfileTab profile={profile} onSave={onSaveProfile} onLogout={onLogout}
        myPeerId={myPeerId} peerStatus={peerStatus} />}

      {/* Thanh tab dưới cùng */}
      <nav className="shrink-0 grid grid-cols-3 border-t border-blue-950/80 bg-slate-950/70 backdrop-blur">
        {TABS.map(({ key, label, Icon, badge }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 transition ${active ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      {showAddContact && (
        <AddContactModal profile={profile} onClose={() => setShowAddContact(false)} onAdded={() => {}} />
      )}
    </div>
  );
};
