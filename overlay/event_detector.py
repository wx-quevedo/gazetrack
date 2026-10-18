"""Event detection over the logger's interval stream (PHASE-02B.1).

A pure consumer: it receives one IntervalSummary per aggregation interval
(5 s) and emits behavioral events when sustained patterns cross a threshold.
It touches neither the gaze pipeline nor the camera. Events are always logged
as metrics; saving a snapshot image for an event is a separate, opt-in step.

Events:
- OFF_SCREEN_SUSTAINED : gaze off-screen continuously for > N s.
- FACE_ABSENT          : no face continuously for > N s (user away).
- DISTRACTION_RETURN   : back on-screen after an off-screen stretch > M min.
- FOCUS_BLOCK_START    : K continuous minutes on-screen, present and active.

A data gap (camera_lost interval) resets all streaks so an outage never
manufactures a false event.
"""

from __future__ import annotations

from dataclasses import dataclass

from PyQt6 import QtCore

from overlay.activity_db import (EVENT_DISTRACTION_RETURN, EVENT_FACE_ABSENT,
                                 EVENT_FOCUS_BLOCK_START,
                                 EVENT_OFF_SCREEN_SUSTAINED)


@dataclass
class IntervalSummary:
    on_screen: bool       # gaze on-screen this interval (fraction >= 0.5)
    face_present: bool     # a face was present (fraction >= 0.5)
    active: bool           # any keyboard/mouse activity
    valid: bool = True     # False on a camera_lost interval (data gap)


class EventDetector(QtCore.QObject):
    eventDetected = QtCore.pyqtSignal(str, float)   # event_type, duration_s

    def __init__(self, interval_s: int, off_screen_sustained_s: int,
                 face_absent_s: int, distraction_return_min: float,
                 focus_block_min: float):
        super().__init__()
        self.interval_s = interval_s
        self._off_s = off_screen_sustained_s
        self._absent_s = face_absent_s
        self._distraction_s = distraction_return_min * 60
        self._focus_s = focus_block_min * 60
        self._reset()

    def _reset(self) -> None:
        self._off_run = 0
        self._absent_run = 0
        self._focus_run = 0
        self._off_fired = False
        self._absent_fired = False
        self._focus_fired = False

    def set_thresholds(self, off_screen_sustained_s: int, face_absent_s: int,
                       distraction_return_min: float,
                       focus_block_min: float) -> None:
        self._off_s = off_screen_sustained_s
        self._absent_s = face_absent_s
        self._distraction_s = distraction_return_min * 60
        self._focus_s = focus_block_min * 60

    def on_interval(self, s: IntervalSummary) -> None:
        iv = self.interval_s
        if not s.valid:
            self._reset()                 # a data gap breaks every streak
            return

        # OFF_SCREEN_SUSTAINED + DISTRACTION_RETURN.
        if not s.on_screen:
            self._off_run += 1
            if self._off_run * iv >= self._off_s and not self._off_fired:
                self._off_fired = True
                self.eventDetected.emit(EVENT_OFF_SCREEN_SUSTAINED,
                                        self._off_run * iv)
        else:
            if self._off_run * iv >= self._distraction_s:
                self.eventDetected.emit(EVENT_DISTRACTION_RETURN,
                                        self._off_run * iv)
            self._off_run = 0
            self._off_fired = False

        # FACE_ABSENT.
        if not s.face_present:
            self._absent_run += 1
            if self._absent_run * iv >= self._absent_s \
                    and not self._absent_fired:
                self._absent_fired = True
                self.eventDetected.emit(EVENT_FACE_ABSENT,
                                        self._absent_run * iv)
        else:
            self._absent_run = 0
            self._absent_fired = False

        # FOCUS_BLOCK_START (on-screen + present + active).
        if s.on_screen and s.face_present and s.active:
            self._focus_run += 1
            if self._focus_run * iv >= self._focus_s and not self._focus_fired:
                self._focus_fired = True
                self.eventDetected.emit(EVENT_FOCUS_BLOCK_START,
                                        self._focus_run * iv)
        else:
            self._focus_run = 0
            self._focus_fired = False
