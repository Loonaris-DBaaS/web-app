import { Outlet } from 'react-router-dom';
import DashboardFooter from '../components/layout/DashboardFooter.jsx';
import Sidebar from '../components/ui/Sidebar.jsx';
export default function DashboardLayout() {
	return (
		<div className="dashboard-shell">
			<Sidebar />
			<main className="dashboard-main">
				<Outlet />
			</main>
            <DashboardFooter />
		</div>

	);
}
