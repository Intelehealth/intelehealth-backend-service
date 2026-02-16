module.exports = (function () {
    this.getVisitCountV3 = () => {
        return `select
            t1.visit_id,
            t1.uuid,
            max_enc,
            encounter.encounter_type,
            encounter_type.name as encounter_type_name,
            case
                when (
                    encounter.encounter_type = 14
                    or encounter.encounter_type = 12
                    or com_enc = 1
                    or ended = 1
                ) then "Completed Visit"
                when (
                    (
                        encounter.encounter_type between 100 and 159
                    )
                    or (encounter_type.name is not null and (
                        lower(encounter_type.name) like "%sos%"
                        or lower(encounter_type.name) like "%emergency%"
                    ))
                ) then "Visit In Progress"
            end as "Status"
        from
            encounter
            left join encounter_type on encounter.encounter_type = encounter_type.encounter_type_id
            join (
                select
                    v.visit_id,
                    v.patient_id,
                    v.uuid,
                    max(encounter_id) as max_enc,
                    max(
                        case
                            when (encounter_type in (12, 14)) then 1
                            else 0
                        end
                    ) as com_enc,
                    max(
                    case
                        when (v.date_stopped is not null) then 1
                        else 0
                    end
                    ) as ended
                from
                    visit v
                    left join encounter e using (visit_id)
                where
                    v.voided = 0
                    and e.voided = 0
                group by
                    v.visit_id,
                    v.patient_id
            ) as t1
        on encounter.encounter_id = max_enc
        order by visit_id desc`;
    };

    this.getVisitScore = (encounter_id) => {
        return `SELECT SUM(t1.score) as total_score FROM (SELECT case when (comments = 'R') then COUNT(comments)*2 when (comments = 'Y') then COUNT(comments) else 0 end as score, max(encounter_id) as max_encounter_id, comments FROM openmrs.obs where encounter_id = ${encounter_id} and voided = 0 and comments is not null group by comments) t1 GROUP BY t1.max_encounter_id`;
    };

    this.getPreviousEncountersByVisit = (visit_id) => {
        // Return encounter id and datetime ordered by encounter_id desc (newest first)
        return `SELECT encounter_id, encounter_datetime FROM openmrs.encounter WHERE visit_id = ${visit_id} AND voided = 0 ORDER BY encounter_id DESC`;
    };

    return this;
})();
