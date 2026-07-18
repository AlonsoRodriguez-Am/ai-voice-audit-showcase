from sqlalchemy.orm import Session
from sqlalchemy import func, case, text, extract
from datetime import datetime, timedelta
from typing import Optional
from app.models.evaluation import Evaluation
from app.models.lob import LOB


def _apply_filters(query, tenant_id: int, date_from: Optional[str] = None, date_to: Optional[str] = None, lob_id: Optional[int] = None, date_range: Optional[str] = None):
    """Apply common date/lob/tenant filters to a query."""
    query = query.filter(Evaluation.tenant_id == tenant_id)
    # Legacy range filter (backward compatible)
    if date_range:
        if date_range == 'today':
            query = query.filter(Evaluation.evaluation_date >= func.current_date())
        elif date_range == 'week':
            query = query.filter(Evaluation.evaluation_date >= func.date_trunc('week', func.current_date()))

    # New date range filters
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            query = query.filter(Evaluation.evaluation_date >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            # Include the entire end day
            dt_to = dt_to.replace(hour=23, minute=59, second=59)
            query = query.filter(Evaluation.evaluation_date <= dt_to)
        except ValueError:
            pass
    if lob_id:
        query = query.filter(Evaluation.lob_id == lob_id)
    return query


def get_dashboard_metrics(db: Session, tenant_id: int, date_range: str = 'all', date_from: str = None, date_to: str = None, lob_id: int = None):
    metrics = {}

    query = db.query(Evaluation)
    query = _apply_filters(query, tenant_id, date_from, date_to, lob_id, date_range)

    # Total evaluations
    metrics['total_evaluations'] = query.count()
    metrics['total_calls'] = metrics['total_evaluations']  # backward compat

    # Average score
    avg_score = query.filter(Evaluation.final_score != None).with_entities(func.avg(Evaluation.final_score)).scalar()
    metrics['average_score'] = round(float(avg_score), 1) if avg_score is not None else 0

    # Calls needing attention / critical alerts
    metrics['calls_needing_attention'] = query.filter(Evaluation.had_error == True).count()
    metrics['critical_alerts'] = metrics['calls_needing_attention']

    # Average TTCA
    avg_ttca = query.filter(Evaluation.ttca_seconds != None).with_entities(func.avg(Evaluation.ttca_seconds)).scalar()
    metrics['average_ttca'] = round(float(avg_ttca), 1) if avg_ttca is not None else 0

    # LOB Distribution
    lob_query = db.query(LOB.name, func.count(Evaluation.id)) \
        .join(Evaluation, Evaluation.lob_id == LOB.id) \
        .filter(Evaluation.had_error == False)
    lob_query = _apply_filters(lob_query, tenant_id, date_from, date_to, lob_id, date_range)
    lob_dist = lob_query.group_by(LOB.name).order_by(func.count(Evaluation.id).desc()).all()
    metrics['lob_distribution'] = [{"name": name, "count": count} for name, count in lob_dist]

    # Score over time (daily averages for the chart)
    score_time_query = db.query(
        func.date(Evaluation.evaluation_date).label('date'),
        func.avg(Evaluation.final_score).label('score')
    ).filter(Evaluation.final_score != None)
    score_time_query = _apply_filters(score_time_query, tenant_id, date_from, date_to, lob_id, date_range)
    score_time = score_time_query.group_by(func.date(Evaluation.evaluation_date)) \
        .order_by(func.date(Evaluation.evaluation_date)).all()
    metrics['score_over_time'] = [
        {"date": str(row.date), "score": round(float(row.score), 1)} for row in score_time
    ]

    # Top Topics
    topics_query = query.filter(Evaluation.topics != None, Evaluation.topics != '') \
        .with_entities(Evaluation.topics).all()

    topic_counts = {}
    for (topics_str,) in topics_query:
        individual_topics = [t.strip().title() for t in topics_str.split(',') if t.strip()]
        for t in individual_topics:
            topic_counts[t] = topic_counts.get(t, 0) + 1

    top_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    metrics['top_topics'] = [{"topic": t[0], "count": t[1]} for t in top_topics]

    # Top Issues (formatted for frontend BarChart)
    metrics['top_issues'] = [{"label": t[0], "count": t[1]} for t in top_topics]

    # CTQ success rate
    ctq_fields = [
        'greeting', 'hipaa_verification', 'resolve_concern',
        'pci_compliance', 'call_closing', 'professionalism', 'call_management'
    ]

    ctq_matches = []
    for field in ctq_fields:
        ai_field = f"{field}_ai"
        match_count = query.filter(
            Evaluation.final_score != None,
            func.lower(getattr(Evaluation, field)) == func.lower(getattr(Evaluation, ai_field))
        ).count()
        ctq_matches.append(match_count)

    total_scored_calls = query.filter(Evaluation.final_score != None).count()

    if total_scored_calls > 0:
        total_matches = sum(ctq_matches)
        total_ctqs_evaluated = total_scored_calls * 7
        metrics['ctq_success_rate'] = round((total_matches / total_ctqs_evaluated) * 100) if total_ctqs_evaluated > 0 else 100
        metrics['ctq_intervention_rate'] = 100 - metrics['ctq_success_rate']
    else:
        metrics['ctq_success_rate'] = 100
        metrics['ctq_intervention_rate'] = 0

    if metrics['total_calls'] > 0:
        metrics['processing_error_rate'] = round((metrics['calls_needing_attention'] / metrics['total_calls']) * 100)
    else:
        metrics['processing_error_rate'] = 0

    return metrics


def get_trends(db: Session, tenant_id: int, period: str = 'week', date_from: str = None, date_to: str = None, lob_id: int = None):
    """Get average score trends grouped by period (week or month)."""
    if period == 'month':
        date_trunc = func.date_trunc('month', Evaluation.evaluation_date)
    else:
        date_trunc = func.date_trunc('week', Evaluation.evaluation_date)

    query = db.query(
        date_trunc.label('period'),
        func.avg(Evaluation.final_score).label('avg_score'),
        func.count(Evaluation.id).label('total_evals'),
        func.count(case((Evaluation.had_error == True, 1))).label('error_count')
    ).filter(Evaluation.final_score != None)

    query = _apply_filters(query, tenant_id, date_from, date_to, lob_id)
    results = query.group_by(date_trunc).order_by(date_trunc).all()

    return [
        {
            "period": str(row.period.date()) if row.period else "",
            "avg_score": round(float(row.avg_score), 1) if row.avg_score else 0,
            "total_evals": row.total_evals,
            "error_count": row.error_count,
        }
        for row in results
    ]


def get_ctq_distribution(db: Session, tenant_id: int, date_from: str = None, date_to: str = None, lob_id: int = None):
    """Get CTQ criteria pass/fail distribution."""
    ctq_fields = [
        ('greeting', 'Greeting'),
        ('hipaa_verification', 'HIPAA Verification'),
        ('resolve_concern', 'Resolve Concern'),
        ('pci_compliance', 'PCI Compliance'),
        ('call_closing', 'Call Closing'),
        ('professionalism', 'Professionalism'),
        ('call_management', 'Call Management'),
    ]

    query = db.query(Evaluation).filter(Evaluation.final_score != None)
    query = _apply_filters(query, tenant_id, date_from, date_to, lob_id)
    total = query.count()

    distribution = []
    for field, label in ctq_fields:
        pass_count = query.filter(func.lower(getattr(Evaluation, field)) == 'yes').count()
        fail_count = query.filter(func.lower(getattr(Evaluation, field)) == 'no').count()
        ai_match = query.filter(func.lower(getattr(Evaluation, field)) == func.lower(getattr(Evaluation, f"{field}_ai"))).count()

        distribution.append({
            "criterion": label,
            "field": field,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round((pass_count / total) * 100, 1) if total > 0 else 0,
            "ai_agreement": round((ai_match / total) * 100, 1) if total > 0 else 0,
        })

    return {"total_evaluated": total, "distribution": distribution}


def get_topic_trends(db: Session, tenant_id: int, period: str = 'week', date_from: str = None, date_to: str = None, lob_id: int = None):
    """Get topic frequency trends over time."""
    if period == 'month':
        date_trunc = func.date_trunc('month', Evaluation.evaluation_date)
    else:
        date_trunc = func.date_trunc('week', Evaluation.evaluation_date)

    query = db.query(
        date_trunc.label('period'),
        Evaluation.topics
    ).filter(Evaluation.topics != None, Evaluation.topics != '')

    query = _apply_filters(query, tenant_id, date_from, date_to, lob_id)
    results = query.order_by(date_trunc).all()

    # Aggregate topics per period
    period_topics = {}
    all_topics = set()
    for row in results:
        period_key = str(row.period.date()) if row.period else "unknown"
        if period_key not in period_topics:
            period_topics[period_key] = {}

        topics = [t.strip().title() for t in row.topics.split(',') if t.strip()]
        for topic in topics:
            all_topics.add(topic)
            period_topics[period_key][topic] = period_topics[period_key].get(topic, 0) + 1

    # Format as array for frontend chart
    # Get top 5 topics overall
    total_topic_counts = {}
    for period_data in period_topics.values():
        for topic, count in period_data.items():
            total_topic_counts[topic] = total_topic_counts.get(topic, 0) + count

    top_5_topics = sorted(total_topic_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_5_names = [t[0] for t in top_5_topics]

    trend_data = []
    for period_key in sorted(period_topics.keys()):
        entry = {"period": period_key}
        for topic in top_5_names:
            entry[topic] = period_topics[period_key].get(topic, 0)
        trend_data.append(entry)

    return {"topics": top_5_names, "data": trend_data}
