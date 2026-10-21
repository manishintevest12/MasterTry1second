import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Lead capture (owner 21 Oct): Loans / Insurance / Credit Cards / Accounts cards
/// open this sheet BEFORE the partner redirect. Details persist server-side
/// (POST /api/leads -> MySQL) and are visible in Admin > Leads. No fabrication:
/// we only forward the enquiry; the partner contacts the user directly.
Future<void> showLeadSheet(
  BuildContext context, {
  required String vertical,
  required String serviceType,
  required String sellerName,
  String? goUrl,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _LeadSheet(
      vertical: vertical,
      serviceType: serviceType,
      sellerName: sellerName,
      goUrl: goUrl,
    ),
  );
}

class _LeadSheet extends StatefulWidget {
  const _LeadSheet({required this.vertical, required this.serviceType, required this.sellerName, this.goUrl});

  final String vertical;
  final String serviceType;
  final String sellerName;
  final String? goUrl;

  @override
  State<_LeadSheet> createState() => _LeadSheetState();
}

class _LeadSheetState extends State<_LeadSheet> {
  final _name = TextEditingController();
  final _age = TextEditingController(text: '');
  final _salary = TextEditingController(text: '');
  final _location = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  int? _leadId;

  @override
  void dispose() {
    _name.dispose(); _age.dispose(); _salary.dispose(); _location.dispose(); _phone.dispose(); _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final age = int.tryParse(_age.text.trim()) ?? 0;
    final salary = double.tryParse(_salary.text.trim().replaceAll(RegExp(r'[^0-9.]'), ''));
    final location = _location.text.trim();
    final email = _email.text.trim();
    // Owner 21 Oct: ALL fields are mandatory. Phone is format-checked only —
    // deliberately NO OTP verification (owner decision), mirroring web/server.
    final phoneDigits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (name.isEmpty) {
      setState(() => _error = 'Please enter your full name');
      return;
    }
    if (age < 18 || age > 100) {
      setState(() => _error = 'Age must be between 18 and 100');
      return;
    }
    if (salary == null || salary < 0) {
      setState(() => _error = 'Monthly income is required');
      return;
    }
    if (location.isEmpty) {
      setState(() => _error = 'City / location is required');
      return;
    }
    if (phoneDigits.isEmpty) {
      setState(() => _error = 'Mobile number is required');
      return;
    }
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(phoneDigits)) {
      setState(() => _error = 'Enter a valid 10-digit Indian mobile number (no OTP needed)');
      return;
    }
    if (email.isEmpty) {
      setState(() => _error = 'Email is required');
      return;
    }
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final parts = name.split(RegExp(r'\s+'));
      final id = await AppState.instance.api.submitLead(
        vertical: widget.vertical,
        serviceType: widget.serviceType,
        firstName: parts.first,
        lastName: parts.length > 1 ? parts.sublist(1).join(' ') : '-',
        age: age,
        salary: salary,
        location: _location.text.trim(),
        phone: _phone.text.trim(),
        email: _email.text.trim(),
        destUrl: widget.goUrl,
      );
      if (mounted) setState(() { _leadId = id; _busy = false; });
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = 'Could not reach the server. Please try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: pad),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: 34, height: 34, alignment: Alignment.center,
                      decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(10)),
                      child: const Text('1S', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 12)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _leadId != null ? 'Enquiry Submitted' : 'Share your details',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                          ),
                          Text(
                            _leadId != null
                                ? 'Ref: lead-$_leadId — ${widget.sellerName} will contact you.'
                                : '${widget.sellerName} · we only forward your enquiry; no approval happens here.',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close, size: 20),
                    ),
                  ],
                ),
                if (_leadId != null) ...[
                  const SizedBox(height: 10),
                  if ((widget.goUrl ?? '').isNotEmpty)
                    RedButton('Continue to partner site', onTap: () {
                      Navigator.of(context).pop();
                      openDeal(widget.goUrl!, sellerName: widget.sellerName);
                    })
                  else
                    RedButton('Done', onTap: () => Navigator.of(context).pop()),
                  const SizedBox(height: 4),
                  const Padding(
                    padding: EdgeInsets.all(8),
                    child: Text(
                      'Your details are stored securely on our servers and shared only with this partner.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                    ),
                  ),
                ] else ...[
                  const SizedBox(height: 8),
                  TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name *', isDense: true)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: TextField(controller: _age, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Age *', isDense: true))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: _salary, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Monthly salary (₹) *', isDense: true))),
                  ]),
                  const SizedBox(height: 8),
                  TextField(controller: _location, decoration: const InputDecoration(labelText: 'City / location *', isDense: true)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile *', isDense: true))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email *', isDense: true))),
                  ]),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(_error!, style: const TextStyle(color: T1SColors.red, fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  const SizedBox(height: 12),
                  RedButton(_busy ? 'Submitting…' : 'Submit enquiry', onTap: _busy ? null : _submit),
                  const SizedBox(height: 4),
                  const Text(
                    'By submitting you agree to be contacted about this product only. See our privacy policy for details.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
