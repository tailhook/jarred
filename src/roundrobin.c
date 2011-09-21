#define RRD_EXPORT_DEPRECATED
#include "roundrobin.h"
#include "buffer.h"

#include <stdio.h>
#include <stdlib.h>
#include <rrd.h>
#include <assert.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <errno.h>
#include <math.h>
typedef unsigned short u_short; // Why would i need this?
#include <fts.h>

#define RRD_READONLY 1
#define STDASSERT(val) if(val < 0) { perror(#val); abort(); }

static void add_info(buffer_t *buf, char *filename) {
    rrd_t rrd;
    rrd_file_t *rrd_file;
    rrd_init(&rrd);
    rrd_file = rrd_open(filename, &rrd, RRD_READONLY);
    assert(rrd_file);
    STDASSERT(buffer_printf(buf, "{\n"));
    STDASSERT(buffer_printf(buf, "\"step\": %d,\n",
        rrd.stat_head->pdp_step));
    STDASSERT(buffer_printf(buf, "\"last_update\": %d,\n",
        rrd.live_head->last_up));
    STDASSERT(buffer_printf(buf, "\"data_sets\": {\n"));
    for (int i = 0; i < rrd.stat_head->ds_cnt; i++) {
        STDASSERT(buffer_printf(buf, "\"%s\": {\n",
            rrd.ds_def[i].ds_nam));
        STDASSERT(buffer_printf(buf, "\"index\": %d,\n", i));
        STDASSERT(buffer_printf(buf, "\"type\": \"%s\",\n",
            rrd.ds_def[i].dst));
        STDASSERT(buffer_printf(buf, "\"last_ds\": \"%s\",\n",
            rrd.pdp_prep[i].last_ds));
        if(isfinite(rrd.pdp_prep[i].scratch[PDP_val].u_val)) {
            STDASSERT(buffer_printf(buf, "\"value\": %f,\n",
                rrd.pdp_prep[i].scratch[PDP_val].u_val));
        } else {
            STDASSERT(buffer_printf(buf, "\"value\": null,\n"));
        }
        if(isfinite(rrd.pdp_prep[i].scratch[PDP_unkn_sec_cnt].u_cnt)) {
            STDASSERT(buffer_printf(buf, "\"unknown_sec\": %f\n",
                rrd.pdp_prep[i].scratch[PDP_unkn_sec_cnt].u_cnt));
        } else {
            STDASSERT(buffer_printf(buf, "\"unknown_sec\": null\n"));
        }
        if(i < rrd.stat_head->ds_cnt-1) {
            STDASSERT(buffer_printf(buf, "},\n"));
        } else {
            STDASSERT(buffer_printf(buf, "}\n"));
        }
    }
    STDASSERT(buffer_printf(buf, "},\n"));
    STDASSERT(buffer_printf(buf, "\"archives\": [\n"));
    for (int i = 0; i < rrd.stat_head->rra_cnt; i++) {
        STDASSERT(buffer_printf(buf, "{\n"));
        STDASSERT(buffer_printf(buf, "\"consolidation_func\": \"%s\",\n",
            rrd.rra_def[i].cf_nam));
        STDASSERT(buffer_printf(buf, "\"rows\": %d,\n",
            rrd.rra_def[i].row_cnt));
        STDASSERT(buffer_printf(buf, "\"current_row\": %d,\n",
            rrd.rra_ptr[i].cur_row));
        STDASSERT(buffer_printf(buf, "\"pdp_per_row\": %d\n",
            rrd.rra_def[i].pdp_cnt));
        if(i < rrd.stat_head->rra_cnt-1) {
            STDASSERT(buffer_printf(buf, "},\n"));
        } else {
            STDASSERT(buffer_printf(buf, "}\n"));
        }
    }
    STDASSERT(buffer_printf(buf, "]}\n"));
    rrd_close(rrd_file);
    rrd_free(&rrd);
}

void traverse_tree(buffer_t *buf, char **dirs, int strip_ch) {
    FTS *fts = fts_open(dirs, FTS_LOGICAL, NULL);
    assert(fts);
    FTSENT *entry;
    STDASSERT(buffer_printf(buf, "{\n"));
    for(int i = 0;;) {
        entry = fts_read(fts);
        if(!entry) break;
        if(entry->fts_info != FTS_F) continue;
        if(i) {
            buffer_printf(buf, ",\n");
        }
        STDASSERT(buffer_printf(buf, "\"%s\":\n", entry->fts_path+strip_ch));
        add_info(buf, entry->fts_accpath);
        ++i;
    }
    STDASSERT(buffer_printf(buf, "}\n"));
    STDASSERT(fts_close(fts));
}

void quickvisit_tree(buffer_t *buf, char **dirs, int strip_ch) {
    FTS *fts = fts_open(dirs, FTS_LOGICAL, NULL);
    assert(fts);
    FTSENT *entry;
    STDASSERT(buffer_printf(buf, "[\n"));
    for(int i = 0;;) {
        entry = fts_read(fts);
        if(!entry) break;
        if(entry->fts_info != FTS_F) continue;
        if(i) {
            buffer_printf(buf, ",\n");
        }
        STDASSERT(buffer_printf(buf, "\"%s\"", entry->fts_path+strip_ch));
        ++i;
    }
    STDASSERT(buffer_printf(buf, "]\n"));
    STDASSERT(fts_close(fts));
}

void format_data(buffer_t *buf, char *filename, char *cf,
    time_t start, time_t end, unsigned long step) {
    unsigned long nds=2;
    char **dnames;
    rrd_value_t *data;
    STDASSERT(rrd_fetch_r(filename, cf, &start, &end, &step,
        &nds, &dnames, &data));
    STDASSERT(buffer_printf(buf, "{\n"));
    STDASSERT(buffer_printf(buf, "\"consolidation_function\": \"%s\",\n", cf));
    STDASSERT(buffer_printf(buf, "\"start\": %lu,\n", start));
    STDASSERT(buffer_printf(buf, "\"end\": %lu,\n", end));
    STDASSERT(buffer_printf(buf, "\"step\": %lu,\n", step));
    STDASSERT(buffer_printf(buf, "\"datasets\": [\n"));
    for(int i = 0; i < nds; ++i) {
        STDASSERT(buffer_printf(buf, "\"%s\"", dnames[i]));
        if(i != nds-1) {
            STDASSERT(buffer_printf(buf, ",\n"));
        } else {
            STDASSERT(buffer_printf(buf, "\n"));
        }
    }
    STDASSERT(buffer_printf(buf, "],\n"));
    STDASSERT(buffer_printf(buf, "\"data\": [\n"));
    int rows = (end - start) / step;
    for(int j = 0; j < rows; ++j) {
        STDASSERT(buffer_printf(buf, "["));
        for(int i = 0; i < nds; ++i) {
            double val = data[j*nds + i];
            if(isinf(val) || isnan(val)) {
                if(i < nds - 1) {
                    STDASSERT(buffer_printf(buf, "null,"));
                } else {
                    STDASSERT(buffer_printf(buf, "null"));
                }
            } else {
                if(i < nds - 1) {
                    STDASSERT(buffer_printf(buf, "%f,", val));
                } else {
                    STDASSERT(buffer_printf(buf, "%f", val));
                }
            }
        }
        if(j < rows - 1) {
            STDASSERT(buffer_printf(buf, "],\n"));
        } else {
            STDASSERT(buffer_printf(buf, "]"));
        }
    }

    STDASSERT(buffer_printf(buf, "]\n"));
    STDASSERT(buffer_printf(buf, "}\n"));
    free(data);
    for(int i = 0; i < nds; ++i) {
        free(dnames[i]);
    }
    free(dnames);
}
