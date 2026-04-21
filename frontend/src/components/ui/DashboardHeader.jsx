import Button from "./Button";
//usage example:
// <DashboardHeader
//   pageTitle="Dashboard"
//   pageDescription="Welcome back, Alex!"
//   username="Alex Rivera"
//   userImageURL="https://example.com/avatar.jpg"
//   buttonText="New Instance"
//   buttonIcon={<span className="material-symbols-outlined">add</span>}
//   buttonOnClick={() => alert('Create new instance')}
// />
export default function DashboardHeader({
  pageTitle,
  pageDescription,
  username,
  userImageURL,
  buttonText,
  buttonIcon,
  buttonOnClick,
}) {
  return (
    <header style={{
      height: 'var(--topbar-height)',
      background: 'var(--surface-container-lowest)',
      borderBottom: '1px solid var(--outline-variant)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 var(--space-8)',
      gap: 'var(--space-4)',
    }}>

      {/* Title + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 'var(--text-title-lg-size)',
          lineHeight: 'var(--text-title-lg-height)',
          fontWeight: 600,
          color: 'var(--on-surface)',
          display: 'block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {pageTitle}
        </span>
        {pageDescription && (
          <p style={{
            fontSize: 'var(--text-body-sm-size)',
            lineHeight: 'var(--text-body-sm-height)',
            color: 'var(--on-surface-variant)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {pageDescription}
          </p>
        )}
      </div>

      {/* Optional action button */}
      {buttonText && buttonOnClick && (
        <Button text={buttonText} icon={buttonIcon} onClick={buttonOnClick} />
      )}

      {/* User profile */}
      {username && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          paddingLeft: 'var(--space-4)',
          borderLeft: '1px solid var(--outline-variant)',
          flexShrink: 0,
        }}>
          {userImageURL ? (
            <img
              src={userImageURL}
              alt={username}
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-full)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-full)',
              background: 'var(--primary-fixed)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-label-md-size)',
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{
            fontSize: 'var(--text-label-lg-size)',
            fontWeight: 500,
            color: 'var(--on-surface)',
          }}>
            {username}
          </span>
        </div>
      )}

    </header>
  );
}