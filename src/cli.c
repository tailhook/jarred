#define RRD_EXPORT_DEPRECATED
#include "buffer.h"
#include <stdio.h>
#include <stdlib.h>
#include <rrd.h>
#include <assert.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <errno.h>
typedef unsigned short u_short;
#include <fts.h>

#define RRD_READONLY 1
#define STDASSERT(val) if(val < 0) { perror(#val); abort(); }

void add_info(buffer_t *buf, char *filename) {
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
        STDASSERT(buffer_printf(buf, "\"value\": %f,\n",
            rrd.pdp_prep[i].scratch[PDP_val].u_val));
        STDASSERT(buffer_printf(buf, "\"unknown_sec\": %f\n",
            rrd.pdp_prep[i].scratch[PDP_unkn_sec_cnt].u_cnt));
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

void traverse_tree(buffer_t *buf, char **argv) {
    FTS *fts = fts_open(argv, FTS_LOGICAL, NULL);
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
        STDASSERT(buffer_printf(buf, "\"%s\":\n", entry->fts_path));
        add_info(buf, entry->fts_accpath);
        ++i;
    }
    STDASSERT(buffer_printf(buf, "}\n"));
    STDASSERT(fts_close(fts));
}

int main(int argc, char **argv) {
    buffer_t buf;
    STDASSERT(buffer_init(&buf, 4096));

    traverse_tree(&buf, argv+1);

    char *start = buf.data;
    char *end = buf.data + buf.size;
    while(start < end) {
        int res = write(1, start, end - start);
        if(res < 0) {
            if(errno == EAGAIN) continue;
            perror("write");
            abort();
        }
        start += res;
    }
    buffer_free(&buf);
    return 0;
}
