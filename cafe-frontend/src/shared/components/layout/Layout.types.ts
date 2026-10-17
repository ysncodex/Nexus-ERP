export interface HeaderProps {
  activeTab: TabId;
  onMobileMenuToggle: () => void;
}

export interface SidebarProps {
  activeTab: TabId;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export type TabId =
  | 'dashboard'
  | 'manager_dashboard'
  | 'daily_record'
  | 'report'
  | 'product_sales'
  | 'daily_expense'
  | 'product_cost'
  | 'consumables'
  | 'fixed_cost'
  | 'fund'
  | 'delivery_settlement'
  | 'pos_sync'
  | 'new_order'
  | 'daily_sales'
  | 'invoices'
  | 'order_history'
  | 'product_list'
  | 'stock_levels'
  | 'suppliers'
  | 'wastage'
  | 'staff_roster'
  | 'payroll';
