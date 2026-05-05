import { NavLink } from 'react-router-dom';

const navItems = [
	{ to: '/dashboard/databases', label: 'Databases' },
	{ to: '/dashboard/settings', label: 'Settings' },
	{ to: '/dashboard/support', label: 'Support' },
];

export default function Sidebar() {
	return (
		<aside className="dashboard-sidebar">
			<div className="dashboard-sidebar__brand">
				<p className="label-sm">DBAAS PLATFORM</p>
				<h1 className="title-lg">Control Plane</h1>
			</div>

			<nav className="dashboard-sidebar__nav" aria-label="Dashboard sections">
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							isActive ? 'dashboard-sidebar__link is-active' : 'dashboard-sidebar__link'
						}
					>
						{item.label}
					</NavLink>
				))}
			</nav>
		</aside>
	);
}