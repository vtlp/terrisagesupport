import { useState } from 'react';
import { Calendar, Download, BarChart3, LineChart, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  const [dateRange, setDateRange] = useState('7d');
  const [product, setProduct] = useState('all');

  const reports = [
    {
      id: 'volume',
      title: 'Ticket Volume',
      description: 'Tickets created vs resolved over time',
      icon: BarChart3,
    },
    {
      id: 'sla',
      title: 'SLA Performance',
      description: 'Response and resolution SLA adherence by queue',
      icon: Clock,
    },
    {
      id: 'workload',
      title: 'Agent Workload',
      description: 'Distribution of tickets and resolution counts per agent',
      icon: LineChart,
    },
    {
      id: 'trends',
      title: 'Category Trends',
      description: 'Popular categories and reopen rates',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Reports</h1>
          <p className="text-muted-foreground">
            Operational insights and performance metrics
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent className="bg-card">
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="crm">CRM</SelectItem>
            <SelectItem value="customer_app">Customer App</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Report Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">
                {report.title}
              </CardTitle>
              <report.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {report.description}
              </p>
              <div className="h-32 bg-muted/50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Chart placeholder
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Created</p>
          <p className="text-2xl font-bold text-secondary">324</p>
          <p className="text-xs text-success mt-1">↑ 12% vs last period</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Resolved</p>
          <p className="text-2xl font-bold text-secondary">298</p>
          <p className="text-xs text-success mt-1">↑ 8% vs last period</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">SLA Met Rate</p>
          <p className="text-2xl font-bold text-secondary">94.2%</p>
          <p className="text-xs text-success mt-1">↑ 2.1% vs last period</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Avg Resolution</p>
          <p className="text-2xl font-bold text-secondary">4.2h</p>
          <p className="text-xs text-success mt-1">↓ 0.5h vs last period</p>
        </div>
      </div>
    </div>
  );
}
