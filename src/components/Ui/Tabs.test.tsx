/**
 * Tests for Tabs component
 * @module components/Ui/Tabs.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  SimpleTabs,
  TestRunnerTabs,
  type TabsVariant,
  type TabsSize,
} from './Tabs';

// ============================================================================
// TESTS
// ============================================================================

describe('Tabs', () => {
  const renderTabs = (props = {}) => {
    return render(
      <Tabs defaultValue="tab1" {...props}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );
  };

  describe('rendering', () => {
    it('should render tabs', () => {
      renderTabs();
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });

    it('should render tab triggers', () => {
      renderTabs();
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('should render default tab content', () => {
      renderTabs();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      renderTabs({ className: 'custom-class' });
      expect(screen.getByTestId('tabs')).toHaveClass('custom-class');
    });
  });

  describe('uncontrolled mode', () => {
    it('should switch tabs on click', async () => {
      const user = userEvent.setup();
      renderTabs();

      await user.click(screen.getByText('Tab 2'));

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });

    it('should use defaultValue', () => {
      renderTabs({ defaultValue: 'tab2' });
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('controlled mode', () => {
    it('should call onValueChange when tab clicked', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      
      render(
        <Tabs value="tab1" onValueChange={onValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      await user.click(screen.getByText('Tab 2'));

      expect(onValueChange).toHaveBeenCalledWith('tab2');
    });

    it('should respect controlled value', () => {
      render(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it.each<TabsVariant>(['underline', 'pills', 'boxed', 'minimal'])(
      'should render %s variant',
      (variant) => {
        renderTabs({ variant });
        expect(screen.getByTestId('tabs')).toBeInTheDocument();
      }
    );
  });

  describe('sizes', () => {
    it.each<TabsSize>(['sm', 'md', 'lg'])('should render %s size', (size) => {
      renderTabs({ size });
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
    });
  });

  describe('orientation', () => {
    it('should render horizontal orientation', () => {
      renderTabs({ orientation: 'horizontal' });
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should render vertical orientation', () => {
      renderTabs({ orientation: 'vertical' });
      expect(screen.getByTestId('tabs')).toHaveAttribute('data-orientation', 'vertical');
    });
  });

  describe('disabled state', () => {
    it('should disable all tabs when globally disabled', () => {
      renderTabs({ disabled: true });
      
      const triggers = screen.getAllByRole('tab');
      triggers.forEach((trigger) => {
        expect(trigger).toBeDisabled();
      });
    });

    it('should disable individual tab', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Tab 2').closest('button')).toBeDisabled();
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate with arrow keys (horizontal)', async () => {
      renderTabs();

      const firstTab = screen.getByText('Tab 1').closest('button')!;
      firstTab.focus();

      fireEvent.keyDown(firstTab.closest('[role="tablist"]')!, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByText('Tab 2').closest('button'));
    });

    it('should wrap around with arrow keys', async () => {
      renderTabs();

      const lastTab = screen.getByText('Tab 3').closest('button')!;
      lastTab.focus();

      fireEvent.keyDown(lastTab.closest('[role="tablist"]')!, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByText('Tab 1').closest('button'));
    });

    it('should navigate to first with Home key', () => {
      renderTabs();

      const lastTab = screen.getByText('Tab 3').closest('button')!;
      lastTab.focus();

      fireEvent.keyDown(lastTab.closest('[role="tablist"]')!, { key: 'Home' });
      expect(document.activeElement).toBe(screen.getByText('Tab 1').closest('button'));
    });

    it('should navigate to last with End key', () => {
      renderTabs();

      const firstTab = screen.getByText('Tab 1').closest('button')!;
      firstTab.focus();

      fireEvent.keyDown(firstTab.closest('[role="tablist"]')!, { key: 'End' });
      expect(document.activeElement).toBe(screen.getByText('Tab 3').closest('button'));
    });
  });

  describe('accessibility', () => {
    it('should have correct ARIA attributes on triggers', () => {
      renderTabs();

      const selectedTab = screen.getByText('Tab 1').closest('button')!;
      expect(selectedTab).toHaveAttribute('role', 'tab');
      expect(selectedTab).toHaveAttribute('aria-selected', 'true');

      const unselectedTab = screen.getByText('Tab 2').closest('button')!;
      expect(unselectedTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should have correct ARIA attributes on content', () => {
      renderTabs();

      const content = screen.getByText('Content 1').closest('[role="tabpanel"]');
      expect(content).toHaveAttribute('role', 'tabpanel');
    });

    it('should have tablist role', () => {
      renderTabs();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });
});

describe('TabsTrigger', () => {
  it('should render icon', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" icon={<span data-testid="icon">Icon</span>}>
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render badge', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" badge={<span data-testid="badge">5</span>}>
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });
});

describe('TabsContent', () => {
  it('should force mount content when forceMount is true', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2" forceMount>Content 2</TabsContent>
      </Tabs>
    );

    // Content 2 should be in DOM but hidden
    const content2 = screen.getByText('Content 2').closest('[role="tabpanel"]');
    expect(content2).toHaveAttribute('hidden');
  });
});

describe('SimpleTabs', () => {
  const tabs = [
    { value: 'a', label: 'Tab A', content: 'Content A' },
    { value: 'b', label: 'Tab B', content: 'Content B' },
    { value: 'c', label: 'Tab C', content: 'Content C', disabled: true },
  ];

  it('should render all tabs', () => {
    render(<SimpleTabs tabs={tabs} />);

    expect(screen.getByText('Tab A')).toBeInTheDocument();
    expect(screen.getByText('Tab B')).toBeInTheDocument();
    expect(screen.getByText('Tab C')).toBeInTheDocument();
  });

  it('should use first tab as default', () => {
    render(<SimpleTabs tabs={tabs} />);
    expect(screen.getByText('Content A')).toBeInTheDocument();
  });

  it('should disable specified tabs', () => {
    render(<SimpleTabs tabs={tabs} />);
    expect(screen.getByText('Tab C').closest('button')).toBeDisabled();
  });
});

describe('TestRunnerTabs', () => {
  it('should render test runner tabs', () => {
    render(
      <TestRunnerTabs
        activeTab="console"
        onTabChange={() => {}}
        consoleContent={<div>Console</div>}
        resultsContent={<div>Results</div>}
      />
    );

    expect(screen.getAllByText('Console').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Results').length).toBeGreaterThan(0);
  });

  it('should call onTabChange when tab clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <TestRunnerTabs
        activeTab="console"
        onTabChange={onTabChange}
        consoleContent={<div>Console Content</div>}
        resultsContent={<div>Results Content</div>}
      />
    );

    await user.click(screen.getByText('Results'));
    expect(onTabChange).toHaveBeenCalledWith('results');
  });

  it('should render optional history tab', () => {
    render(
      <TestRunnerTabs
        activeTab="console"
        onTabChange={() => {}}
        consoleContent={<div>Console</div>}
        resultsContent={<div>Results</div>}
        historyContent={<div>History</div>}
      />
    );

    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('should render badges on tabs', () => {
    render(
      <TestRunnerTabs
        activeTab="console"
        onTabChange={() => {}}
        consoleContent={<div>Console</div>}
        resultsContent={<div>Results</div>}
        consoleBadge={<span data-testid="console-badge">10</span>}
      />
    );

    expect(screen.getByTestId('console-badge')).toBeInTheDocument();
  });
});
