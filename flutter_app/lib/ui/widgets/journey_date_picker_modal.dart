import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'kit.dart';

/// Port of the web JourneyDatePickerModal (owner 22 Oct: date hints MANDATORY on
/// every vertical in the app, same UI as the site): quick-select pills
/// (Today / Tomorrow / This Weekend), month grid with locked past dates,
/// single-date or check-in/check-out range selection, legend and an
/// "Apply Selected Date" confirm button. Never fabricates — pure calendar math.
class JourneyDateResult {
  final DateTime departure;
  final DateTime? returnDate;
  const JourneyDateResult(this.departure, this.returnDate);
}

const _kMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const _kWeekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

DateTime _midnight(DateTime d) => DateTime(d.year, d.month, d.day);

String _fmt(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}-${d.month.toString().padLeft(2, '0')}-${d.year}';

/// Shows the reference-style date modal. Returns null when dismissed.
Future<JourneyDateResult?> showJourneyDatePicker(
  BuildContext context, {
  required String title,
  bool isRange = false,
  bool returnOptional = false,
  DateTime? initialDeparture,
  DateTime? initialReturn,
  Color accent = const Color(0xFFE11D48),
}) {
  return showDialog<JourneyDateResult>(
    context: context,
    builder: (c) => _JourneyDatePickerModal(
      title: title,
      isRange: isRange,
      returnOptional: returnOptional,
      initialDeparture: initialDeparture,
      initialReturn: initialReturn,
      accent: accent,
    ),
  );
}

class _JourneyDatePickerModal extends StatefulWidget {
  const _JourneyDatePickerModal({
    required this.title,
    required this.isRange,
    required this.returnOptional,
    this.initialDeparture,
    this.initialReturn,
    required this.accent,
  });

  final String title;
  final bool isRange;
  final bool returnOptional;
  final DateTime? initialDeparture;
  final DateTime? initialReturn;
  final Color accent;

  @override
  State<_JourneyDatePickerModal> createState() => _JourneyDatePickerModalState();
}

class _JourneyDatePickerModalState extends State<_JourneyDatePickerModal> {
  late final DateTime _today = _midnight(DateTime.now());
  late DateTime _dep;
  DateTime? _ret;
  late bool _selectingReturn;
  late int _viewYear;
  late int _viewMonth;

  @override
  void initState() {
    super.initState();
    _dep = _isPast(widget.initialDeparture) ? _today : _midnight(widget.initialDeparture!);
    if (widget.isRange && !widget.returnOptional) {
      _ret = widget.initialReturn != null &&
              _midnight(widget.initialReturn!).isAfter(_dep)
          ? _midnight(widget.initialReturn!)
          : _dep.add(const Duration(days: 3));
    } else if (widget.isRange && widget.returnOptional && widget.initialReturn != null) {
      _ret = _midnight(widget.initialReturn!);
    }
    _selectingReturn = false;
    _viewYear = _dep.year;
    _viewMonth = _dep.month - 1;
  }

  bool _isPast(DateTime? d) => d == null || _midnight(d).isBefore(_today);

  bool _same(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  bool _inRange(DateTime d) =>
      widget.isRange && _ret != null && d.isAfter(_dep) && d.isBefore(_ret!);

  void _dayTapped(DateTime d) {
    if (d.isBefore(_today)) return;
    if (!widget.isRange) {
      setState(() => _dep = d);
      return;
    }
    setState(() {
      if (!_selectingReturn) {
        _dep = d;
        if (_ret != null && !_ret!.isAfter(d)) {
          _ret = widget.returnOptional ? null : d.add(const Duration(days: 2));
        }
        _selectingReturn = true;
      } else {
        if (!d.isAfter(_dep)) {
          _dep = d;
          if (widget.returnOptional) _ret = null;
        } else {
          _ret = d;
          _selectingReturn = false;
        }
      }
    });
  }

  void _quick(int addDays, {bool weekend = false}) {
    var d = _today.add(Duration(days: addDays));
    if (weekend) {
      // Next Saturday (never today's weekday repeat).
      final daysUntilSat = (DateTime.saturday - d.weekday) % 7;
      d = d.add(Duration(days: daysUntilSat == 0 ? 7 : daysUntilSat));
    }
    setState(() {
      _dep = d;
      if (widget.isRange) {
        _ret = widget.returnOptional ? null : d.add(Duration(days: weekend ? 2 : 3));
      }
      _selectingReturn = false;
      _viewYear = d.year;
      _viewMonth = d.month - 1;
    });
  }

  void _apply() {
    Navigator.pop(context, JourneyDateResult(_dep, widget.isRange ? _ret : null));
  }

  @override
  Widget build(BuildContext context) {
    final dark = isDark(context);
    final card = dark ? T1SColors.slate800 : Colors.white;
    final titleColor = dark ? T1SColors.slate50 : Colors.black;
    final mutedColor = dark ? T1SColors.slate400 : T1SColors.slate500;
    final daysInMonth = DateTime(_viewYear, _viewMonth + 1, 0).day;
    final startOffset = (DateTime(_viewYear, _viewMonth + 1, 1).weekday + 6) % 7;
    final canPrev = _viewYear > _today.year || (_viewYear == _today.year && _viewMonth >= _today.month);

    final summary = !widget.isRange || _ret == null
        ? _fmt(_dep)
        : '${_fmt(_dep)} → ${_fmt(_ret!)}';

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(16)),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header: calendar icon + title + selected date + (Today) pill + X
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 8, 10),
                child: Row(
                  children: [
                    Icon(Icons.calendar_month_rounded, size: 18, color: mutedColor),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.title.toUpperCase(),
                            style: tx(context, 9, w: FontWeight.w900,
                                color: mutedColor),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(_fmt(_dep),
                                  style: tx(context, 13.5, w: FontWeight.w900, color: titleColor)),
                              if (_same(_dep, _today)) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD1FADF),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text('(Today)',
                                      style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFF15803D))),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: Icon(Icons.close_rounded, size: 18, color: mutedColor),
                    ),
                  ],
                ),
              ),
              // Quick select pills
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                child: Row(
                  children: [
                    _pill('⚡ Today (${_fmt(_today)})', () => _quick(0)),
                    const SizedBox(width: 6),
                    _pill('Tomorrow (+1D)', () => _quick(1)),
                    const SizedBox(width: 6),
                    _pill('This Weekend', () => _quick(0, weekend: true)),
                  ],
                ),
              ),
              // Step sub-header (range mode)
              if (widget.isRange)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _selectingReturn
                              ? 'Step 2: Select Check-out'
                              : 'Step 1: Select Check-in',
                          style: tx(context, 10.5, w: FontWeight.w900, color: widget.accent),
                        ),
                      ),
                      Text(
                        'Check-out: ${_ret != null ? _fmt(_ret!) : '—'}',
                        style: tx(context, 10.5, w: FontWeight.w900, color: widget.accent),
                      ),
                    ],
                  ),
                ),
              // Month nav + grid
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: canPrev
                          ? () => setState(() {
                                if (_viewMonth == 0) {
                                  _viewMonth = 11;
                                  _viewYear--;
                                } else {
                                  _viewMonth--;
                                }
                              })
                          : null,
                      icon: Icon(Icons.chevron_left_rounded,
                          size: 20, color: canPrev ? mutedColor : T1SColors.slate300),
                    ),
                    Expanded(
                      child: Center(
                        child: Text('${_kMonths[_viewMonth]} $_viewYear',
                            style: tx(context, 12.5, w: FontWeight.w900, color: titleColor)),
                      ),
                    ),
                    IconButton(
                      onPressed: () => setState(() {
                        if (_viewMonth == 11) {
                          _viewMonth = 0;
                          _viewYear++;
                        } else {
                          _viewMonth++;
                        }
                      }),
                      icon: Icon(Icons.chevron_right_rounded, size: 20, color: mutedColor),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
                child: Row(
                  children: [
                    for (final w in _kWeekdays)
                      Expanded(
                        child: Center(
                          child: Text(w,
                              style: tx(context, 8.5, w: FontWeight.w900, color: mutedColor)),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
                child: Column(
                  children: [
                    for (var week = 0; week * 7 < startOffset + daysInMonth; week++)
                      Row(
                        children: [
                          for (var col = 0; col < 7; col++)
                            Expanded(child: _cell(week, col, startOffset, daysInMonth, dark, mutedColor, titleColor)),
                        ],
                      ),
                  ],
                ),
              ),
              // Legend
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Row(
                  children: [
                    Icon(Icons.circle_outlined, size: 11, color: widget.accent),
                    const SizedBox(width: 4),
                    Text('Today', style: tx(context, 9.5, color: mutedColor)),
                    const SizedBox(width: 12),
                    Icon(Icons.lock_outline_rounded, size: 11, color: mutedColor),
                    const SizedBox(width: 4),
                    Text('Past dates locked', style: tx(context, 9.5, color: mutedColor)),
                  ],
                ),
              ),
              // Footer: confirmed choice + apply
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                decoration: BoxDecoration(
                  color: dark ? T1SColors.slate900 : T1SColors.slate50,
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('CONFIRMED CHOICE',
                              style: tx(context, 8.5, w: FontWeight.w900,
                                  color: mutedColor)),
                          const SizedBox(height: 2),
                          Text(summary,
                              style: tx(context, 13, w: FontWeight.w900, color: titleColor)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: widget.accent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: _apply,
                      icon: const Icon(Icons.check_rounded, size: 16),
                      label: Text('Apply Selected Date',
                          style: tx(context, 11, w: FontWeight.w900)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pill(String label, VoidCallback onTap) {
    final dark = isDark(context);
    return Flexible(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: dark ? T1SColors.slate900 : Colors.white,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: dark ? T1SColors.slate700 : T1SColors.slate200),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: tx(context, 9.5, w: FontWeight.w900, color: dark ? T1SColors.slate100 : Colors.black),
          ),
        ),
      ),
    );
  }

  Widget _cell(int week, int col, int startOffset, int daysInMonth, bool dark, Color mutedColor, Color titleColor) {
    final dayNum = week * 7 + col - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return const SizedBox(height: 38);
    final d = DateTime(_viewYear, _viewMonth + 1, dayNum);
    final past = d.isBefore(_today);
    final isDep = _same(d, _dep);
    final isRet = _ret != null && _same(d, _ret!);
    final isToday = _same(d, _today);
    final inRange = _inRange(d);
    final selected = isDep || isRet;
    Color bg = Colors.transparent;
    if (selected) {
      bg = widget.accent;
    } else if (inRange) {
      bg = dark ? T1SColors.slate700 : const Color(0xFFFFF7EE);
    }
    final textColor = selected
        ? Colors.white
        : past
            ? (dark ? T1SColors.slate600 : T1SColors.slate300)
            : titleColor;
    return InkWell(
      onTap: past ? null : () => _dayTapped(d),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: 38,
        margin: const EdgeInsets.all(1.5),
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: isToday && !selected
              ? Border.all(color: widget.accent, width: 1.4)
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          '$dayNum',
          style: tx(context, 11, w: selected || isToday ? FontWeight.w900 : FontWeight.w600, color: textColor),
        ),
      ),
    );
  }
}
