// ============================================================================
//  GALAXY — Avatar dùng chung (port từ contacts-parts.jsx, giữ palette 2 tông).
//  Cố ý dùng palette theo TÊN (design token) cho đồng nhất hiệu ứng "vì sao",
//  thay vì avatarColor đơn sắc của Ourspace.
// ============================================================================
(function () {
  const D = window.CONTACTS_DATA;

  function Avatar({ name, size = 44, online, square, ring }) {
    const pair = D.colorFor(name);
    const bg = pair[0], fg = pair[1];
    const radius = square ? Math.round(size * 0.28) : '50%';
    return (
      <span className="av" style={{ width: size, height: size, flex: `0 0 ${size}px` }}>
        <span className="av-img" style={{
          background: bg, color: fg, borderRadius: radius,
          fontSize: size * 0.4, boxShadow: ring ? '0 0 0 3px #fff' : 'none',
        }}>{D.initials(name)}</span>
        {online && <span className="av-dot" style={{ borderRadius: square ? 4 : '50%' }} />}
      </span>
    );
  }

  window.ContactsParts = { Avatar };
})();
