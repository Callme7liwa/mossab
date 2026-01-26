import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Database, 
  Shield, 
  Clock, 
  TrendingUp, 
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  History,
  Home,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProperties } from "@/hooks/useProperties";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface SyncLogEntry {
  id: number;
  status: string;
  started_at: string;
  completed_at: string;
  properties_synced: number;
  error?: string;
}

interface MultiListingProperty {
  addressKey: string;
  address: string;
  city: string;
  listingCount: number;
  firstListDate: string;
  lastActivity: string;
  statuses: string;
  firstSalePrice?: number;
  lastSalePrice?: number;
  appreciation?: string;
}

interface DataQualityIssue {
  type: string;
  count: number;
  severity: "high" | "medium" | "low";
  description: string;
}

export default function DataManagement() {
  const { properties: allProperties, loading: propertiesLoading } = useProperties({ top: 5000 });
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [multiListings, setMultiListings] = useState<MultiListingProperty[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Fetch sync history
      const syncRes = await fetch(`${BACKEND_URL}/api/sync/status`);
      const syncData = await syncRes.json();
      
      // Fetch all sync logs
      const historyRes = await fetch(`${BACKEND_URL}/api/stats`);
      const statsData = await historyRes.json();
      
      // Fetch multiple listings
      const multiRes = await fetch(`${BACKEND_URL}/api/analytics/multiple-listings`);
      const multiData = await multiRes.json();
      
      if (syncData.lastSync) {
        setSyncHistory([syncData.lastSync]);
      }
      setDbStats(statsData);
      setMultiListings(multiData.properties || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Database health stats
  const healthStats = useMemo(() => {
    if (!dbStats) return [];
    
    return [
      { 
        label: "Total Properties", 
        value: dbStats.totalCount || 0, 
        icon: Database,
        color: "bg-blue-500"
      },
      { 
        label: "Active Listings", 
        value: dbStats.statusCounts?.Active || 0, 
        icon: Home,
        color: "bg-green-500"
      },
      { 
        label: "Closed Sales", 
        value: dbStats.statusCounts?.Closed || 0, 
        icon: TrendingUp,
        color: "bg-purple-500"
      },
      { 
        label: "Avg Price", 
        value: dbStats.avgPrice ? `$${(dbStats.avgPrice / 1000000).toFixed(2)}M` : "$0", 
        icon: BarChart3,
        color: "bg-amber-500"
      },
    ];
  }, [dbStats]);

  // Data quality issues
  const qualityIssues = useMemo<DataQualityIssue[]>(() => {
    if (allProperties.length === 0) return [];
    
    const issues: DataQualityIssue[] = [];
    
    const missingPhotos = allProperties.filter(p => !p.photoUrl).length;
    const missingCoords = allProperties.filter(p => !p.latitude || !p.longitude).length;
    const zeroDom = allProperties.filter(p => p.dom === 0 && p.status === 'Active').length;
    const zeroSqft = allProperties.filter(p => p.sqft === 0 || !p.sqft).length;
    const outlierPrices = allProperties.filter(p => p.price > 10000000 || p.price < 100000).length;
    
    if (missingPhotos > 0) {
      issues.push({
        type: "Missing Photos",
        count: missingPhotos,
        severity: "low",
        description: `${missingPhotos} properties have no photos`
      });
    }
    
    if (missingCoords > 0) {
      issues.push({
        type: "Missing Coordinates",
        count: missingCoords,
        severity: "medium",
        description: `${missingCoords} properties missing lat/lng (affects map features)`
      });
    }
    
    if (zeroDom > 0) {
      issues.push({
        type: "Zero DOM",
        count: zeroDom,
        severity: "low",
        description: `${zeroDom} active listings show 0 days on market`
      });
    }
    
    if (zeroSqft > 0) {
      issues.push({
        type: "Missing Sq Ft",
        count: zeroSqft,
        severity: "high",
        description: `${zeroSqft} properties missing square footage data`
      });
    }
    
    if (outlierPrices > 0) {
      issues.push({
        type: "Price Outliers",
        count: outlierPrices,
        severity: "medium",
        description: `${outlierPrices} properties with unusual prices (<$100K or >$10M)`
      });
    }
    
    return issues;
  }, [allProperties]);

  // Flip analysis
  const flipAnalysis = useMemo(() => {
    const quickFlips = multiListings.filter(p => {
      const statuses = p.statuses.split(',');
      return statuses.filter(s => s === 'Closed').length >= 2;
    });
    
    const flipsWithAppreciation = quickFlips.filter(p => p.appreciation && !isNaN(Number(p.appreciation)));
    const avgAppreciation = flipsWithAppreciation.length > 0
      ? flipsWithAppreciation.reduce((sum, p) => sum + Number(p.appreciation), 0) / flipsWithAppreciation.length
      : 0;
    
    return {
      totalMultiListings: multiListings.length,
      propertiesSoldMultiple: quickFlips.length,
      avgAppreciation: avgAppreciation.toFixed(1),
      top10Flips: multiListings.slice(0, 10)
    };
  }, [multiListings]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Database health, sync status, and data quality monitoring
            </p>
          </div>
          <Button onClick={fetchAdminData} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Health Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {healthStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${stat.color} bg-opacity-10 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="flips">Flip Analysis</TabsTrigger>
          <TabsTrigger value="sync">Sync History</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>

        {/* Data Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Data Quality Issues
                </h3>
                <Badge variant={qualityIssues.length === 0 ? "default" : "secondary"}>
                  {qualityIssues.length} {qualityIssues.length === 1 ? 'issue' : 'issues'}
                </Badge>
              </div>

              {qualityIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="text-lg font-semibold text-foreground">All Clear!</p>
                  <p className="text-sm text-muted-foreground">No data quality issues detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qualityIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        issue.severity === 'high' 
                          ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                          : issue.severity === 'medium'
                          ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                          : 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                      }`}
                    >
                      <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                        issue.severity === 'high' 
                          ? 'text-red-500'
                          : issue.severity === 'medium'
                          ? 'text-amber-500'
                          : 'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-foreground">{issue.type}</p>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              issue.severity === 'high' 
                                ? 'border-red-300 text-red-700 dark:text-red-400'
                                : issue.severity === 'medium'
                                ? 'border-amber-300 text-amber-700 dark:text-amber-400'
                                : 'border-blue-300 text-blue-700 dark:text-blue-400'
                            }`}
                          >
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{issue.description}</p>
                      </div>
                      <span className="font-bold text-lg text-foreground">{issue.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </TabsContent>

        {/* Flip Analysis Tab */}
        <TabsContent value="flips" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Activity className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{flipAnalysis.totalMultiListings}</p>
                  <p className="text-xs text-muted-foreground">Multi-Listed Properties</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{flipAnalysis.propertiesSoldMultiple}</p>
                  <p className="text-xs text-muted-foreground">Potential Flips</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{flipAnalysis.avgAppreciation}%</p>
                  <p className="text-xs text-muted-foreground">Avg Appreciation</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Top Properties with Multiple Listings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-xs font-semibold text-muted-foreground pb-2">Address</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground pb-2">City</th>
                    <th className="text-center text-xs font-semibold text-muted-foreground pb-2">Listings</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground pb-2">Status History</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground pb-2">Appreciation</th>
                  </tr>
                </thead>
                <tbody>
                  {flipAnalysis.top10Flips.map((property, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-3 text-sm font-medium text-foreground max-w-[200px] truncate">
                        {property.address}
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">{property.city}</td>
                      <td className="py-3 text-center">
                        <Badge variant="secondary">{property.listingCount}x</Badge>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                        {property.statuses}
                      </td>
                      <td className="py-3 text-right">
                        {property.appreciation ? (
                          <span className={`font-semibold ${Number(property.appreciation) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {Number(property.appreciation) >= 0 ? '+' : ''}{property.appreciation}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Sync History Tab */}
        <TabsContent value="sync" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-semibold text-foreground">
                Recent Sync Activity
              </h3>
            </div>

            {syncHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <XCircle className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-lg font-semibold text-foreground">No Sync History</p>
                <p className="text-sm text-muted-foreground">No synchronization records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {syncHistory.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 bg-muted rounded-lg">
                    <div className={`p-2 rounded-lg ${
                      log.status === 'completed' 
                        ? 'bg-green-500/10' 
                        : log.status === 'failed'
                        ? 'bg-red-500/10'
                        : 'bg-blue-500/10'
                    }`}>
                      {log.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : log.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-red-500" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground">
                          {log.status === 'completed' ? 'Sync Completed' : log.status === 'failed' ? 'Sync Failed' : 'Syncing...'}
                        </span>
                        <Badge variant={log.status === 'completed' ? 'default' : 'secondary'}>
                          {log.properties_synced} properties
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(log.started_at).toLocaleString()}
                      </p>
                      {log.completed_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed: {new Date(log.completed_at).toLocaleString()}
                        </p>
                      )}
                      {log.error && (
                        <p className="text-xs text-red-500 mt-1">Error: {log.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Database Stats */}
          <Card className="p-6">
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Database Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dbStats && dbStats.statusCounts && Object.entries(dbStats.statusCounts).map(([status, count]: [string, any]) => (
                <div key={status} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">{status}</span>
                  <span className="font-bold text-foreground">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// User Management Component
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  created_at: string;
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_URL}/api/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: number, status: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_URL}/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const updateUserRole = async (userId: number, role: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_URL}/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role })
      });

      if (response.ok) {
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${BACKEND_URL}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'inactive');
  const activeUsers = users.filter(u => u.status === 'active');

  return (
    <div className="space-y-6">
      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Pending Approvals ({pendingUsers.length})
              </h3>
            </div>
            <div className="space-y-3">
              {pendingUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                  <div>
                    <p className="font-semibold text-foreground">
                      {user.firstName || user.lastName 
                        ? `${user.firstName} ${user.lastName}`.trim() 
                        : 'No name provided'}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Registered: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => updateUserStatus(user.id, 'active')}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(user.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Active Users */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Active Users ({activeUsers.length})
            </h3>
            <Button onClick={fetchUsers} size="sm" variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : (
            <div className="space-y-2">
              {activeUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        {user.firstName || user.lastName 
                          ? `${user.firstName} ${user.lastName}`.trim() 
                          : 'No name'}
                      </p>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Member since: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateUserRole(user.id, 'admin')}
                      >
                        Make Admin
                      </Button>
                    )}
                    {user.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateUserRole(user.id, 'user')}
                      >
                        Remove Admin
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateUserStatus(user.id, 'inactive')}
                    >
                      Suspend
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(user.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
