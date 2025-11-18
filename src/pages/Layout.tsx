
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "../utils/index";
import {
  LayoutDashboard,
  Disc,
  MapPin,
  Play,
  Settings,
  User,
  LogOut,
  Zap
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "../components/Ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/Ui/dropdown-menu";
import { Button } from "../components/Ui/button";
import { Avatar, AvatarFallback } from "../components/Ui/avatar";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Recorder",
    url: createPageUrl("Recorder"),
    icon: Disc,
  },
  {
    title: "Field Mapper",
    url: createPageUrl("FieldMapper"),
    icon: MapPin,
  },
  {
    title: "Test Runner",
    url: createPageUrl("TestRunner"),
    icon: Play,
  },
  // {
  //   title: "Reports",
  //   url: createPageUrl("Reports"),
  //   icon: BarChart3,
  // },
];
interface LayoutProps {
  children: ReactNode;
}
export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <style>
          {`
            :root {
              --background: 222 84% 4%;
              --foreground: 210 40% 98%;
              --primary: 217 91% 60%;
              --primary-foreground: 222 84% 4%;
              --secondary: 217 32% 17%;
              --secondary-foreground: 210 40% 98%;
              --accent: 217 32% 17%;
              --accent-foreground: 210 40% 98%;
              --destructive: 0 63% 31%;
              --destructive-foreground: 210 40% 98%;
              --border: 217 32% 17%;
              --input: 217 32% 17%;
              --ring: 217 91% 60%;
              --radius: 0.75rem;
            }
            
            .glass-effect {
              backdrop-filter: blur(20px);
              background: rgba(255, 255, 255, 0.05);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .gradient-border {
              background: linear-gradient(45deg, #3B82F6, #8B5CF6, #06B6D4);
              padding: 1px;
              border-radius: 12px;
            }
            
            .gradient-border-inner {
              background: #0F172A;
              border-radius: 11px;
            }
          `}
        </style>

        <Sidebar className="border-r border-slate-700 bg-slate-900/80 backdrop-blur-xl">
          <SidebarHeader className="border-b border-slate-700 p-6">
            <div className="flex items-center gap-3">
              <div className="gradient-border">
                <div className="gradient-border-inner w-10 h-10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <div>
                <h2 className="font-bold text-xl text-white">TestFlow</h2>
                <p className="text-xs text-slate-400">Web Testing Automation</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-3">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`group transition-all duration-200 rounded-xl ${location.pathname === item.url
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                          }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-700 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-4 py-3 h-auto hover:bg-slate-800"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-500 text-white text-sm">
                      U
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white text-sm">Developer</p>
                    <p className="text-xs text-slate-400">Pro Plan</p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 bg-slate-800 border-slate-700 text-white"
              >
                <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem className="hover:bg-slate-700 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-screen">
          {/* Mobile header */}
          <header className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-700 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-white hover:bg-slate-800 p-2 rounded-lg" />
              <h1 className="text-xl font-bold text-white">TestFlow</h1>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
