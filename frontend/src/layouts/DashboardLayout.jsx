import { Outlet } from 'react-router-dom';
import Sidebar from '../components/ui/Sidebar';
import DashboardFooter from '../components/ui/DashboardFooter';
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
