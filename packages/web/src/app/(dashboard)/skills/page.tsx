import { Check, Code, Database, FileText, Globe, Plus, Search, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const skills = [
  {
    id: '1',
    name: 'Web Search',
    description:
      'Search the web using multiple search engines and return structured results with source citations.',
    icon: Globe,
    tags: ['search', 'web'],
    installed: true,
  },
  {
    id: '2',
    name: 'Code Execution',
    description:
      'Execute code snippets in isolated sandboxes supporting Python, JavaScript, and TypeScript.',
    icon: Terminal,
    tags: ['code', 'sandbox'],
    installed: true,
  },
  {
    id: '3',
    name: 'SQL Query',
    description:
      'Run read-only SQL queries against configured databases with automatic schema introspection.',
    icon: Database,
    tags: ['database', 'query'],
    installed: false,
  },
  {
    id: '4',
    name: 'Document Parser',
    description: 'Extract text, tables, and metadata from PDFs, DOCX, and other document formats.',
    icon: FileText,
    tags: ['documents', 'parsing'],
    installed: true,
  },
  {
    id: '5',
    name: 'API Connector',
    description:
      'Make authenticated HTTP requests to external APIs with configurable retry and rate limiting.',
    icon: Code,
    tags: ['api', 'integration'],
    installed: false,
  },
  {
    id: '6',
    name: 'Web Scraper',
    description:
      'Extract structured data from web pages with CSS selectors and automatic content detection.',
    icon: Search,
    tags: ['web', 'scraping'],
    installed: false,
  },
];

export default function SkillsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Browse, install, and manage skills for your agents.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 size-4" />
          Submit Skill
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <Card key={skill.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                  <skill.icon className="size-5 text-muted-foreground" />
                </div>
                {skill.installed && (
                  <Badge variant="secondary">
                    <Check className="mr-1 size-3" />
                    Installed
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base">{skill.name}</CardTitle>
              <CardDescription className="line-clamp-2">{skill.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              {skill.installed ? (
                <Button variant="outline" size="sm" className="w-full">
                  Configure
                </Button>
              ) : (
                <Button size="sm" className="w-full">
                  Install
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
