import Footer from '../../components/layout/Footer/Footer';
import Navbar from '../../components/layout/Navbar/Navbar';
import './Landing.css';

function Hero() {
  return (
    <section className="heroSection">
      <div className="heroGrid">
        <div className="heroCopy">
          <div className="badge">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              bolt
            </span>
            NEW: GLOBAL READ REPLICAS
          </div>

          <h1 className="heroTitle">
            Your database.
            <br />
            <span className="heroAccent">Zero ops.</span>
          </h1>

          <p className="heroSub">
            Spin up, manage, and scale PostgreSQL without the infrastructure hassle. Focus on your
            code, we'll handle the queries.
          </p>

          <div className="heroCtas">
            <button className="ctaPrimary">Start for free</button>
            <button className="ctaSecondary">
              <span className="material-symbols-outlined">terminal</span>
              View Docs
            </button>
          </div>
        </div>

        <div className="terminalWrap">
          <div className="glow1" />
          <div className="glow2" />
          <div className="terminalCard">
            <div className="terminalInner">
              <div className="terminalBar">
                <span className="dot" style={{ background: '#ff5f56' }} />
                <span className="dot" style={{ background: '#ffbd2e' }} />
                <span className="dot" style={{ background: '#27c93f' }} />
                <span className="terminalLabel">PostgreSQL Instance — prod-db-01</span>
              </div>
              <div className="terminalBody">
                <div className="terminalLine">
                  <span className="tIndigo">loonaris</span>
                  <span className="tMuted">deploy</span>
                  <span className="tGreen">--region us-east-1</span>
                </div>
                <p className="tMuted">Preparing architecture... done</p>
                <p className="tMuted">Provisioning compute engine... done</p>
                <p className="tMuted">Initializing Postgres 15.4... done</p>
                <p className="tSuccess">✓ Instance online at: db.loonaris.io/p-1022</p>
                <div className="statusRow">
                  <span className="pulse" />
                  <span className="statusText">Active &amp; Scaling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="featuresSection">
      <div className="featureHeader">
        <h2 className="featureTitle">Engineered for velocity.</h2>
        <p className="label-lg">Standard features, elevated infrastructure.</p>
      </div>

      <div className="bentoGrid">
        <div className="bentoCard bentoBig">
          <div className="bentoBigGlow" />
          <div>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 36,
                color: 'var(--primary)',
                marginBottom: 'var(--space-6)',
                display: 'block',
              }}
            >
              rocket_launch
            </span>
            <h3 className="bentoCardTitle">One-click PostgreSQL</h3>
            <p className="bentoCardBody">
              Deploy production-ready databases in seconds. No more yaml hell or manual tuning.
            </p>
          </div>
          <div className="progressCard">
            <div className="progressHeader">
              <span className="progressLabel">Setup Progress</span>
              <span className="progressValue">98%</span>
            </div>
            <div className="progressTrack">
              <div className="progressFill" style={{ width: '98%' }} />
            </div>
          </div>
        </div>

        <div className="bentoCard bentoAccent">
          <div className="bentoIconWrap">
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
              trending_up
            </span>
          </div>
          <div>
            <h3 className="bentoAccentTitle">Auto scaling</h3>
            <p className="bentoAccentBody">
              Resources that grow with your traffic. Automatically. No downtime, ever.
            </p>
          </div>
        </div>

        <div className="bentoCard bentoSmall">
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 36,
              color: 'var(--secondary)',
              marginBottom: 'var(--space-4)',
              display: 'block',
            }}
          >
            content_copy
          </span>
          <h3 className="bentoCardTitle" style={{ textAlign: 'center' }}>
            Read replicas
          </h3>
        </div>

        <div className="bentoCard bentoMed">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 36, color: 'var(--warning)' }}
            >
              settings_backup_restore
            </span>
            <div>
              <h3 className="bentoCardTitle">Backups &amp; restore</h3>
              <p className="label-md">Point-in-time recovery to any second.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="poolingBanner">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-6)',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 36, color: 'var(--primary)' }}
          >
            rebase_edit
          </span>
          <div>
            <h3 className="bentoCardTitle">Connection pooling</h3>
            <p className="bentoCardBody">
              Handle thousands of simultaneous connections with built-in PgBouncer.
            </p>
          </div>
        </div>
        <button className="poolingBtn">Enable Pooler</button>
      </div>
    </section>
  );
}

const freeTier = [
  '1 Database instance',
  '512MB Storage',
  '7-day automated backups',
  'Shared compute',
];
const freeOff = ['Read replicas'];
const proTier = [
  'Unlimited DBs',
  'Dedicated compute (2 vCPU)',
  'Up to 5 Read replicas',
  '30-day backups (PITR)',
  'Custom domains & SSL',
];

function Pricing() {
  return (
    <section className="pricingSection">
      <div className="pricingInner">
        <div className="featureHeader">
          <h2 className="featureTitle">Transparent pricing.</h2>
          <p className="label-lg">Start for free, scale when you're ready.</p>
        </div>

        <div className="pricingGrid">
          <div className="pricingCard">
            <div>
              <p className="label-lg" style={{ marginBottom: 'var(--space-1)' }}>
                Free Tier
              </p>
              <div className="priceRow">
                <span className="priceAmt">$0</span>
                <span className="label-md">/month</span>
              </div>
            </div>
            <ul className="featureList">
              {freeTier.map((f) => (
                <li key={f} className="featureItem">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: 'var(--success)', fontSize: 20 }}
                  >
                    check_circle
                  </span>
                  {f}
                </li>
              ))}
              {freeOff.map((f) => (
                <li key={f} className="featureItem featureOff">
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    cancel
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="pricingBtnSecondary">Get Started</button>
          </div>

          <div className="pricingCard pricingCardDark">
            <div className="recommendedBadge">Recommended</div>
            <div>
              <p className="proTierLabel">Pro Tier</p>
              <div className="priceRow">
                <span className="priceAmt priceAmtLight">$29</span>
                <span className="pricePerLight">/month</span>
              </div>
            </div>
            <ul className="featureList">
              {proTier.map((f) => (
                <li key={f} className="featureItem featureItemLight">
                  <span
                    className="material-symbols-outlined"
                    style={{ color: 'var(--primary-fixed)', fontSize: 20 }}
                  >
                    check_circle
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button className="pricingBtnPrimary">Upgrade Now</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTABanner() {
  return (
    <section className="ctaSection">
      <div className="ctaDotPattern" />
      <div className="ctaContent">
        <h2 className="ctaTitle">Ready to stop worrying about infrastructure?</h2>
        <button className="ctaBannerBtn">Deploy your first DB</button>
        <p className="ctaSub">Join developers building on Loonaris.</p>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <main className="main">
        <Navbar />
        <Hero />
        <Features />
        <Pricing />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
