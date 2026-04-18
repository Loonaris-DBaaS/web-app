import './Navbar.css';

export default function Navbar(){
    return(
    <header className="header">
        <div className="inner">
            <div className="left">
                <span className = "logo">Loonaris</span>
                <nav className="nav">
                    <a href="#">Features</a>
                    <a href="#">Pricing</a>
                    <a href="#">Docs</a>
                </nav>
            </div>
            <div className="actions">
                <button className="signIn">Sign In</button>
                <button className="cta">Start for free</button>
            </div>

        </div>

    </header>)
}