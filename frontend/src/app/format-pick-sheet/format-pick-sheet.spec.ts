import { render, screen, fireEvent } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormatPickSheetComponent, FormatPickSheetData } from './format-pick-sheet';
import { EngagementService } from '../engagement.service';

const baseData: FormatPickSheetData = {
  bookId: 'book-1',
  title: 'Dune',
  cover_url: null,
  default_audio_minutes: null,
};

type MockEngagementService = Pick<EngagementService, 'markReading' | 'reloadEngagements'>;

async function setup(
  dataOverrides: Partial<FormatPickSheetData> = {},
  serviceOverrides: Record<string, unknown> = {},
) {
  const mockDialogRef = { close: vi.fn() };
  const mockEngagementService = {
    markReading: vi.fn(() => of({})),
    reloadEngagements: vi.fn(),
    ...serviceOverrides,
  } as unknown as MockEngagementService;

  await render(FormatPickSheetComponent, {
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: { ...baseData, ...dataOverrides } },
      { provide: MatDialogRef, useValue: mockDialogRef },
      { provide: EngagementService, useValue: mockEngagementService },
    ],
  });

  return { mockDialogRef, mockEngagementService };
}

describe('FormatPickSheetComponent', () => {
  it('renders the book title', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeTruthy();
  });

  it('renders format buttons', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Start reading Dune as Print' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start reading Dune as Digital' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start reading Dune as Audio' })).toBeTruthy();
  });

  it('calls markReading with the chosen format for print', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Print' }));
    expect(mockEngagementService.markReading).toHaveBeenCalledWith('book-1', 'print', undefined);
  });

  it('calls markReading with the chosen format for digital', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Digital' }));
    expect(mockEngagementService.markReading).toHaveBeenCalledWith('book-1', 'digital', undefined);
  });

  it('calls markReading immediately for audio when length is known', async () => {
    const { mockEngagementService } = await setup({ default_audio_minutes: 600 });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    expect(mockEngagementService.markReading).toHaveBeenCalledWith('book-1', 'audio', undefined);
  });

  it('shows a length input instead of calling markReading for audio without a length', async () => {
    const { mockEngagementService } = await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    expect(mockEngagementService.markReading).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('hides format buttons when collecting audio length', async () => {
    await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    expect(screen.queryByRole('button', { name: 'Start reading Dune as Print' })).toBeNull();
  });

  it('calls markReading with the parsed length when submitted', async () => {
    const { mockEngagementService } = await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    expect(mockEngagementService.markReading).toHaveBeenCalledWith('book-1', 'audio', 630);
  });

  it('disables the start button when the length input is invalid', async () => {
    await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(
      (screen.getByRole('button', { name: 'Start reading Dune as Audio' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows a format error for invalid HH:MM input', async () => {
    await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/enter a time in HH:MM format/i)).toBeTruthy();
  });

  it('goes back to format picking when Go back is clicked', async () => {
    await setup({ default_audio_minutes: null });
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Audio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByRole('button', { name: 'Start reading Dune as Print' })).toBeTruthy();
  });

  it('reloads engagements and closes on success', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Print' }));
    expect(mockEngagementService.reloadEngagements).toHaveBeenCalledOnce();
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('shows an error and keeps the sheet open on failure', async () => {
    const { mockDialogRef } = await setup(
      {},
      { markReading: vi.fn(() => throwError(() => new Error('server error'))) },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start reading Dune as Print' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed to start reading');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('closes the sheet without starting when cancel is clicked', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
    expect(mockEngagementService.markReading).not.toHaveBeenCalled();
  });
});
