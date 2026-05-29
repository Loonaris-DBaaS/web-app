import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Settings() {
	const { user, updateProfile } = useAuth();
	const [formData, setFormData] = useState({ username: '', country: '', photoUrl: '' });
	const [success, setSuccess] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (user) {
			setFormData({
				username: user.username || '',
				country: user.country || '',
				photoUrl: user.photoUrl || '',
			});
		}
	}, [user]);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSuccess('');
		setError('');
		setLoading(true);
		try {
			await updateProfile(formData);
			setSuccess('Profile updated successfully!');
			setTimeout(() => setSuccess(''), 3000);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<section className="dashboard-simple-page">
			<h2 className="headline-sm">Settings</h2>
			<p className="body-md dashboard-simple-page__text">
				Configure your account, security, and cluster defaults.
			</p>

			{/* Profile Update Form */}
			<div style={{ marginTop: '2rem', maxWidth: '600px' }}>
				<div style={{
					padding: '1.5rem',
					borderRadius: 'var(--shape-corner-md)',
					background: 'var(--surface-container)',
					border: '1px solid var(--outline-variant)',
				}}>
					<h3 style={{
						fontSize: 'var(--text-title-md-size)',
						marginBottom: '1.5rem',
						fontWeight: 600,
					}}>
						Profile Settings
					</h3>

					{error && <p style={{ color: '#ff4757', marginBottom: '1rem' }}>{error}</p>}
					{success && <p style={{ color: '#2ecc71', marginBottom: '1rem' }}>{success}</p>}

					<form onSubmit={handleSubmit}>
						{/* Username */}
						<div style={{ marginBottom: '1.5rem' }}>
							<label style={{
								display: 'block',
								marginBottom: '0.5rem',
								fontSize: 'var(--text-label-md-size)',
								fontWeight: 500,
							}}>
								Full Name
							</label>
							<input
								type="text"
								name="username"
								value={formData.username}
								onChange={handleChange}
								placeholder="Your name"
								style={{
									width: '100%',
									padding: '0.75rem',
									borderRadius: 'var(--shape-corner-sm)',
									border: '1px solid var(--outline)',
									fontSize: 'var(--text-body-md-size)',
									fontFamily: 'inherit',
									boxSizing: 'border-box',
								}}
							/>
						</div>

						{/* Country */}
						<div style={{ marginBottom: '1.5rem' }}>
							<label style={{
								display: 'block',
								marginBottom: '0.5rem',
								fontSize: 'var(--text-label-md-size)',
								fontWeight: 500,
							}}>
								Country
							</label>
							<input
								type="text"
								name="country"
								value={formData.country}
								onChange={handleChange}
								placeholder="Your country"
								style={{
									width: '100%',
									padding: '0.75rem',
									borderRadius: 'var(--shape-corner-sm)',
									border: '1px solid var(--outline)',
									fontSize: 'var(--text-body-md-size)',
									fontFamily: 'inherit',
									boxSizing: 'border-box',
								}}
							/>
						</div>

						{/* Photo URL */}
						<div style={{ marginBottom: '1.5rem' }}>
							<label style={{
								display: 'block',
								marginBottom: '0.5rem',
								fontSize: 'var(--text-label-md-size)',
								fontWeight: 500,
							}}>
								Photo URL
							</label>
							<input
								type="url"
								name="photoUrl"
								value={formData.photoUrl}
								onChange={handleChange}
								placeholder="https://example.com/photo.jpg"
								style={{
									width: '100%',
									padding: '0.75rem',
									borderRadius: 'var(--shape-corner-sm)',
									border: '1px solid var(--outline)',
									fontSize: 'var(--text-body-md-size)',
									fontFamily: 'inherit',
									boxSizing: 'border-box',
								}}
							/>
						</div>

						{/* Submit Button */}
						<button
							type="submit"
							disabled={loading}
							style={{
								padding: '0.75rem 1.5rem',
								borderRadius: 'var(--shape-corner-sm)',
								background: 'var(--primary)',
								color: 'var(--on-primary)',
								border: 'none',
								fontSize: 'var(--text-label-lg-size)',
								fontWeight: 600,
								cursor: loading ? 'not-allowed' : 'pointer',
								opacity: loading ? 0.6 : 1,
							}}
						>
							{loading ? 'Saving...' : 'Save Changes'}
						</button>
					</form>
				</div>
			</div>
		</section>
	);
}
