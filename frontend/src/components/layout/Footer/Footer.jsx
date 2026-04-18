import './Footer.css';

const links = {
  Product: ['Dashboard', 'Scaling', 'Pricing'],
  Company: ['About', 'Blog', 'Careers'],
  Support: ['Documentation', 'API Status', 'Contact Us'],
};

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-logo">Loonaris</span>
            <p>blablabla</p>
          </div>

          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="footer-group-title">{group}</h4>
              <ul className="footer-link-list">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <p className="label-md">© 2026 Loonaris Inc. All rights reserved.</p>
          <div className="footer-socials">
            <a href="#">
              <span className="material-symbols-outlined">public</span>
            </a>
            <a href="#">
              <span className="material-symbols-outlined">alternate_email</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
