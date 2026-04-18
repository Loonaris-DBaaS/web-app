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
                <button className="signIn"><a href="signin">Sign In</a></button>
                <button className="cta"><a href="signup">Start for free</a></button>
            </div>

        </div>

    </header>)
}