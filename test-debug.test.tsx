import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectDialog } from './src/components/Dashboard/CreateProjectDialog';

describe('Debug Test', () => {
  it('should show URL validation error', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog isOpen={true} onClose={vi.fn()} onCreate={vi.fn()} />);
    
    const nameInput = screen.getByTestId('create-project-dialog-name');
    const urlInput = screen.getByTestId('create-project-dialog-url');
    const submitBtn = screen.getByTestId('create-project-dialog-submit');
    
    await user.type(nameInput, 'Test Project');
    await user.type(urlInput, 'invalid-url');
    
    console.log('Before submit - name:', nameInput.value, 'url:', urlInput.value);
    
    await user.click(submitBtn);
    
    // Check for error testid
    const errorElement = screen.queryByTestId('project-url-error');
    console.log('Error element:', errorElement);
    console.log('Full DOM:', screen.debug());
  });
});
