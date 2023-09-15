module.exports = (function () {
    this.getVisitCountV3 = () => {
        return `select
            t1.visit_id,
            t1.uuid,
            max_enc,
            encounter_type,
            case
                when (
                    encounter_type = 14
                    or encounter_type = 12
                    or com_enc = 1
                    or ended = 1
                ) then "Completed Visit"
                when (
                    (
                        encounter_type between 100 and 159
                    )
                ) then "Visit In Progress"
            end as "Status"
        from
            encounter,
            (
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
                    LEFT JOIN encounter e using (visit_id)
                where
                    v.voided = 0
                    and e.voided = 0
                group by
                    v.visit_id,
                    v.patient_id
            ) as t1
        where
            encounter_id = max_enc
        order by visit_id desc`;
    };

    this.getVisitScore = (encounter_id) => {
        return `SELECT SUM(t1.score) as total_score FROM (SELECT case when (comments = 'R') then COUNT(comments)*2 when (comments = 'Y') then COUNT(comments) else 0 end as score, max(encounter_id) as max_encounter_id, comments FROM openmrs.obs where encounter_id = ${encounter_id} and voided = 0 and comments is not null group by comments) t1 GROUP BY t1.max_encounter_id`;
        // return `SELECT COUNT(comments) as count, comments FROM obs WHERE encounter_id = ${encounter_id} AND voided = 0 AND comments IS NOT NULL GROUP BY comments`;
    };

    return this;
})();
