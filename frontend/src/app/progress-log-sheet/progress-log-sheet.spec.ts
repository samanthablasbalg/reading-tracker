import { render, screen, fireEvent } from '@testing-library/angular';
import { Observable, of, throwError } from 'rxjs';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ProgressLogSheetComponent, ProgressLogSheetData } from './progress-log-sheet';
import { EngagementService } from '../engagement.service';

const baseData: ProgressLogSheetData = {
  engagementId: 'eng-1',
  title: 'Dune',
  cover_url: null,
  formats: ['print'],
  resume_from_page: 50,
  resume_from_minute: 0,
  default_page_count: 412,
  default_audio_minutes: null,
};

type MockEngagementService = Pick<
  EngagementService,
  'logProgress' | 'patchEngagementInPlace' | 'markFinished' | 'markDnf' | 'reloadEngagements'
>;

async function setup(
  dataOverrides: Partial<ProgressLogSheetData> = {},
  serviceOverrides: Record<string, unknown> = {},
) {
  const mockDialogRef = { close: vi.fn() };
  const mockEngagementService = {
    logProgress: vi.fn(() => of({})),
    patchEngagementInPlace: vi.fn(),
    markFinished: vi.fn(() => of({})),
    markDnf: vi.fn(() => of({})),
    reloadEngagements: vi.fn(),
    ...serviceOverrides,
  } as unknown as MockEngagementService;

  await render(ProgressLogSheetComponent, {
    providers: [
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
      { provide: MAT_DIALOG_DATA, useValue: { ...baseData, ...dataOverrides } },
      { provide: MatDialogRef, useValue: mockDialogRef },
      { provide: EngagementService, useValue: mockEngagementService },
    ],
  });

  return { mockDialogRef, mockEngagementService };
}

describe('ProgressLogSheetComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 30, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the book title', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Dune' })).toBeTruthy();
  });

  it('does not render an image when cover_url is null', async () => {
    await setup();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders a cover image when cover_url is set', async () => {
    await setup({ cover_url: 'https://example.com/cover.jpg' });
    const img = screen.getByRole('img', { name: 'Dune cover' }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/cover.jpg');
  });

  it('opens the page input empty', async () => {
    await setup();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('');
  });

  it('disables Save on open before any page is entered', async () => {
    await setup();
    expect(
      (screen.getByRole('button', { name: 'Save progress for Dune' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('does not show an error just from blurring an untouched field', async () => {
    await setup();
    fireEvent.blur(screen.getByRole('spinbutton'));
    expect(screen.queryByText(/must be greater than page 50/i)).toBeNull();
  });

  it('does not show a min error while still typing, before the field is left', async () => {
    await setup();
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '50' } });
    expect(screen.queryByText(/must be greater than page 50/i)).toBeNull();
  });

  it('shows the min error again if you refocus and edit after already leaving the field once', async () => {
    await setup();
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '100' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/must be greater than page 50/i)).toBeNull();

    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: '50' } });
    expect(screen.queryByText(/must be greater than page 50/i)).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByText(/must be greater than page 50/i)).toBeTruthy();
  });

  it('shows a min error once an invalid page is entered and the field is left', async () => {
    await setup();
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '50' } });
    fireEvent.blur(screen.getByRole('spinbutton'));
    expect(screen.getByText(/must be greater than page 50/i)).toBeTruthy();
  });

  it('does not show a min error just from toggling the date picker', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    expect(screen.queryByText(/must be greater than page 50/i)).toBeNull();
  });

  it('save calls logProgress with the engagement id and entered page', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_page: 100 },
      '2026-06-30',
    );
  });

  it('patches the engagement in place and closes on save success', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.patchEngagementInPlace).toHaveBeenCalledWith('eng-1', {
      resume_from_page: 100,
      completion_pct: 24,
    });
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('passes null completion_pct when page count is unknown', async () => {
    const { mockEngagementService } = await setup({ default_page_count: null });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.patchEngagementInPlace).toHaveBeenCalledWith('eng-1', {
      resume_from_page: 100,
      completion_pct: null,
    });
  });

  it('shows Saving… and disables the button while the request is in flight', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    await setup(
      {},
      {
        logProgress: vi.fn(
          () =>
            new Observable((sub) => {
              promise.then(() => sub.next({}));
            }),
        ),
      },
    );
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    const button = screen.getByRole('button', {
      name: 'Save progress for Dune',
    }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.textContent).toContain('Saving…');
    expect(button.disabled).toBe(true);
    resolve();
  });

  it('shows an inline error and keeps the sheet open on save failure', async () => {
    const { mockDialogRef } = await setup(
      {},
      { logProgress: vi.fn(() => throwError(() => new Error('server error'))) },
    );
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed to save');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('preserves the page input value after a save failure', async () => {
    await setup({}, { logProgress: vi.fn(() => throwError(() => new Error())) });
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(input.value).toBe('100');
  });

  it('disables Save and does not submit when page exceeds page count', async () => {
    const { mockEngagementService } = await setup({ default_page_count: 300 });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });

  it('saves when page equals the page count', async () => {
    const { mockEngagementService } = await setup({ default_page_count: 300 });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_page: 300 },
      '2026-06-30',
    );
  });

  it('still requires entering the final page when resume_from_page equals the page count', async () => {
    await setup({ resume_from_page: 200, default_page_count: 200 });
    expect(
      (screen.getByRole('button', { name: 'Save progress for Dune' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('calls logProgress with the final page when resume_from_page equals the page count', async () => {
    const { mockEngagementService } = await setup({
      resume_from_page: 200,
      default_page_count: 200,
    });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_page: 200 },
      '2026-06-30',
    );
  });

  // --- Backdating ---

  it('does not show a date input until the calendar toggle is clicked', async () => {
    await setup();
    expect(screen.queryByLabelText('Log date')).toBeNull();
  });

  it('reveals a date input capped at today when the calendar toggle is clicked', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    const dateInput = screen.getByLabelText('Log date') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.max).toBe('2026-06-30');
  });

  it('clicking the toggle again hides the date input and resets to today', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    fireEvent.change(screen.getByLabelText('Log date'), { target: { value: '2026-06-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    expect(screen.queryByLabelText('Log date')).toBeNull();

    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_page: 100 },
      '2026-06-30',
    );
  });

  it('save sends the chosen past date when backdated', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    fireEvent.change(screen.getByLabelText('Log date'), { target: { value: '2026-06-10' } });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_page: 100 },
      '2026-06-10',
    );
  });

  it('shows the backend detail message on a 409 conflict', async () => {
    await setup(
      {},
      {
        logProgress: vi.fn(() =>
          throwError(() => ({
            status: 409,
            error: { detail: 'A log already exists on a later day.' },
          })),
        ),
      },
    );
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(screen.getByRole('alert').textContent).toContain('A log already exists on a later day.');
  });

  it('clears a stale save error once the page is edited again', async () => {
    await setup({}, { logProgress: vi.fn(() => throwError(() => ({ status: 409, error: {} }))) });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '120' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears a stale save error once the log date is edited again', async () => {
    await setup({}, { logProgress: vi.fn(() => throwError(() => ({ status: 409, error: {} }))) });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Log for a different day' }));
    fireEvent.change(screen.getByLabelText('Log date'), { target: { value: '2026-06-10' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('closes the sheet without saving when cancel is clicked', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });

  it('does not submit when page count is unknown and no page is entered', async () => {
    const { mockEngagementService } = await setup({
      default_page_count: null,
      resume_from_page: 0,
    });
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });

  // --- Finish ---

  it('always shows a confirm prompt before finishing', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    expect(screen.getByText('Mark "Dune" as finished?')).toBeTruthy();
  });

  it('warns about discarding the entered page when it was edited', async () => {
    await setup();
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    expect(screen.getByText(/finish and discard the page you entered \(100\)/i)).toBeTruthy();
  });

  it('does not call markFinished until the prompt is confirmed', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    expect(mockEngagementService.markFinished).not.toHaveBeenCalled();
  });

  it('calls markFinished, reloads, and closes when the prompt is confirmed', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm finish Dune' }));
    expect(mockEngagementService.markFinished).toHaveBeenCalledWith('eng-1');
    expect(mockEngagementService.reloadEngagements).toHaveBeenCalledOnce();
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('goes back to the form with the input intact from the finish prompt', async () => {
    await setup();
    fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.queryByText(/finish and discard/i)).toBeNull();
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('100');
  });

  it('shows the in-flight label and disables the confirm button while finishing', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    await setup(
      {},
      {
        markFinished: vi.fn(
          () =>
            new Observable((sub) => {
              promise.then(() => sub.next({}));
            }),
        ),
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    const button = screen.getByRole('button', { name: 'Confirm finish Dune' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.textContent).toContain('Finishing');
    expect(button.disabled).toBe(true);
    resolve();
  });

  it('shows an inline error and keeps the sheet open on finish failure', async () => {
    const { mockDialogRef } = await setup(
      {},
      { markFinished: vi.fn(() => throwError(() => new Error('server error'))) },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm finish Dune' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed to finish');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  // --- DNF ---

  it('always shows a confirm prompt before giving up', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    expect(screen.getByText('Give up on Dune?')).toBeTruthy();
  });

  it('does not call markDnf until the prompt is confirmed', async () => {
    const { mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    expect(mockEngagementService.markDnf).not.toHaveBeenCalled();
  });

  it('calls markDnf, reloads, and closes when the prompt is confirmed', async () => {
    const { mockDialogRef, mockEngagementService } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm dnf Dune' }));
    expect(mockEngagementService.markDnf).toHaveBeenCalledWith('eng-1');
    expect(mockEngagementService.reloadEngagements).toHaveBeenCalledOnce();
    expect(mockDialogRef.close).toHaveBeenCalledOnce();
  });

  it('goes back to the form from the give-up prompt', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.queryByText('Give up on Dune?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mark Dune as DNF' })).toBeTruthy();
  });

  it('shows the in-flight label and disables the confirm button while giving up', async () => {
    const { resolve, promise } = Promise.withResolvers<void>();
    await setup(
      {},
      {
        markDnf: vi.fn(
          () =>
            new Observable((sub) => {
              promise.then(() => sub.next({}));
            }),
        ),
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    const button = screen.getByRole('button', { name: 'Confirm dnf Dune' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.textContent).toContain('DNFing');
    expect(button.disabled).toBe(true);
    resolve();
  });

  it('shows an inline error and keeps the sheet open on give-up failure', async () => {
    const { mockDialogRef } = await setup(
      {},
      { markDnf: vi.fn(() => throwError(() => new Error('server error'))) },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as DNF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm dnf Dune' }));
    expect(screen.getByRole('alert').textContent).toContain('Failed to DNF');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  // --- Audio ---

  const audioData: Partial<ProgressLogSheetData> = {
    formats: ['audio'],
    resume_from_minute: 75,
    default_audio_minutes: 600,
  };

  it('shows an HH:MM input for audio format', async () => {
    await setup(audioData);
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('opens the minute input empty', async () => {
    await setup(audioData);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('disables Save on open before any timestamp is entered', async () => {
    await setup(audioData);
    expect(
      (screen.getByRole('button', { name: 'Save progress for Dune' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('save calls logProgress with current_minute for audio', async () => {
    const { mockEngagementService } = await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '02:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).toHaveBeenCalledWith(
      'eng-1',
      { current_minute: 150 },
      '2026-06-30',
    );
  });

  it('patches the engagement with resume_from_minute and completion_pct on save', async () => {
    const { mockEngagementService } = await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '02:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.patchEngagementInPlace).toHaveBeenCalledWith('eng-1', {
      resume_from_minute: 150,
      completion_pct: 25,
    });
  });

  it('passes null completion_pct when audio length is unknown', async () => {
    const { mockEngagementService } = await setup({
      ...audioData,
      default_audio_minutes: null,
    });
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '02:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.patchEngagementInPlace).toHaveBeenCalledWith('eng-1', {
      resume_from_minute: 150,
      completion_pct: null,
    });
  });

  it('shows a format error for invalid HH:MM input', async () => {
    await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/enter a time in HH:MM format/i)).toBeTruthy();
  });

  it('shows a min error when time does not advance past resume_from_minute', async () => {
    await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '01:00' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/must be after 01:15/i)).toBeTruthy();
  });

  it('shows a max error when time exceeds the audio length', async () => {
    await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '11:00' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/cannot exceed 10:00/i)).toBeTruthy();
  });

  it('does not submit when HH:MM input is invalid', async () => {
    const { mockEngagementService } = await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'not-a-time' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save progress for Dune' }));
    expect(mockEngagementService.logProgress).not.toHaveBeenCalled();
  });

  it('warns about discarding the entered timestamp when finishing with edits', async () => {
    await setup(audioData);
    fireEvent.input(screen.getByRole('textbox'), { target: { value: '02:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark Dune as finished' }));
    expect(
      screen.getByText(/finish and discard the timestamp you entered \(02:30\)/i),
    ).toBeTruthy();
  });
});
